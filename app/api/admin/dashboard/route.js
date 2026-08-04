import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { nepalDateString, formatNepalDateTime } from '@/lib/report-dates.js';
import { requireAuth } from '@/lib/api-guard.js';
import { dateKey } from '@/lib/reports.js';

const COST_RATIO = 0.6; // ponytail: flat food-cost heuristic (no per-item cost ledger); swap for recipe-cost rollup if that becomes available

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const db = Database.getInstance();
    const today = nepalDateString(new Date());
    const yesterday = nepalDateString(new Date(Date.now() - 86400000));

    const [
      todaySalesRow,
      yesterdaySalesRow,
      todayOrdersRow,
      yesterdayOrdersRow,
      occupiedRow,
      totalTablesRow,
      lowStockItems,
      pendingTickets,
      unpaidBills,
      soonReservations,
      recentOrders,
      completedTickets,
      checkedInReservations,
      recentMovements,
      dailyBills,
      topItemToday,
      bestEmployeeToday,
      busiestTableToday,
    ] = await Promise.all([
      db.get(`SELECT COALESCE(SUM(amount), 0) as total FROM bill_payments WHERE DATE(created_at) = ?`, [today]),
      db.get(`SELECT COALESCE(SUM(amount), 0) as total FROM bill_payments WHERE DATE(created_at) = ?`, [yesterday]),
      db.get(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = ?`, [today]),
      db.get(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = ?`, [yesterday]),
      db.get(`SELECT COUNT(*) as c FROM tables WHERE status = 'occupied' AND COALESCE(is_active, 1) = 1`),
      db.get(`SELECT COUNT(*) as c FROM tables WHERE COALESCE(is_active, 1) = 1`),
      db.all(`
        SELECT item_name as name, quantity, unit, min_stock_level
        FROM inventory_items
        WHERE quantity <= COALESCE(min_stock_level, 0)
        ORDER BY (quantity - COALESCE(min_stock_level, 0)) ASC
        LIMIT 6
      `),
      db.all(`
        SELECT k.id, k.status, k.printed_at, k.started_at, o.table_number, o.order_number
        FROM kots k
        JOIN orders o ON k.order_id = o.id
        WHERE k.status IN ('pending', 'preparing')
      `),
      db.all(`
        SELECT b.id, b.bill_number, b.created_at, o.table_number
        FROM bills b
        LEFT JOIN orders o ON b.order_id = o.id
        WHERE COALESCE(b.status, 'unpaid') = 'unpaid'
        ORDER BY b.created_at ASC
        LIMIT 6
      `),
      db.all(`
        SELECT id, name, phone, date, time, party_size, guests, status
        FROM reservations
        WHERE date = ? AND status IN ('new', 'confirmed')
      `, [today]),
      db.all(`
        SELECT id, order_number, table_number, order_type, created_at
        FROM orders
        WHERE DATE(created_at) = ?
        ORDER BY created_at DESC
        LIMIT 20
      `, [today]),
      db.all(`
        SELECT k.id, k.completed_at, o.table_number
        FROM kots k
        JOIN orders o ON k.order_id = o.id
        WHERE k.status = 'completed' AND DATE(k.completed_at) = ?
        ORDER BY k.completed_at DESC
        LIMIT 20
      `, [today]),
      db.all(`
        SELECT id, name, checked_in_at
        FROM reservations
        WHERE checked_in_at IS NOT NULL AND DATE(checked_in_at) = ?
        ORDER BY checked_in_at DESC
        LIMIT 20
      `, [today]),
      db.all(`
        SELECT m.id, m.change_type, m.quantity_changed, m.created_at, im.item_name
        FROM stock_movements m
        LEFT JOIN inventory_items im ON m.inventory_item_id = im.id
        WHERE m.change_type IN ('manual_restock', 'purchase_receipt', 'wastage', 'adjustment', 'manual_adjustment', 'opening_balance')
          AND DATE(m.created_at) = ?
        ORDER BY m.created_at DESC
        LIMIT 20
      `, [today]),
      db.all(`
        SELECT DATE(created_at) as d, COUNT(*) as orders, COALESCE(SUM(grand_total), 0) as revenue
        FROM bills
        WHERE DATE(created_at) BETWEEN ? AND ? AND COALESCE(status, 'paid') = 'paid'
        GROUP BY DATE(created_at)
        ORDER BY d ASC
      `, [nepalDateString(new Date(Date.now() - 6 * 86400000)), today]),
      db.all(`
        SELECT COALESCE(oi.item_name, mi.name, 'Item') as name, SUM(oi.quantity) as qty
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON COALESCE(oi.menu_item_id, oi.item_id) = mi.id
        WHERE DATE(o.created_at) = ? AND COALESCE(oi.status, '') NOT IN ('voided', 'cancelled')
        GROUP BY COALESCE(oi.item_name, mi.name, 'Item')
        ORDER BY qty DESC
        LIMIT 1
      `, [today]),
      db.get(`
        SELECT u.full_name as name, COUNT(*) as c
        FROM orders o
        JOIN users u ON o.waiter_id = u.id
        WHERE DATE(o.created_at) = ?
        GROUP BY u.full_name
        ORDER BY c DESC
        LIMIT 1
      `, [today]),
      db.get(`
        SELECT table_number, COUNT(*) as c
        FROM orders
        WHERE DATE(created_at) = ? AND table_number IS NOT NULL
        GROUP BY table_number
        ORDER BY c DESC
        LIMIT 1
      `, [today]),
    ]);

    const sales = n(todaySalesRow?.total);
    const prevSales = n(yesterdaySalesRow?.total);
    const orders = n(todayOrdersRow?.c);
    const prevOrders = n(yesterdayOrdersRow?.c);
    const profit = sales - sales * COST_RATIO;
    const prevProfit = prevSales - prevSales * COST_RATIO;

    // Needs Attention — merge real signals only, cap the list.
    const needsAttention = [];
    for (const item of lowStockItems || []) {
      const qty = n(item.quantity);
      const min = n(item.min_stock_level);
      needsAttention.push({
        type: qty <= 0 ? 'out_of_stock' : 'low_stock',
        text: qty <= 0
          ? `${item.name} is out of stock`
          : `${item.name} is low on stock (${qty} ${item.unit || ''} left)`,
      });
    }
    const now = Date.now();
    for (const t of pendingTickets || []) {
      const started = new Date(t.printed_at || t.started_at).getTime();
      if (!Number.isFinite(started)) continue;
      const minutes = Math.round((now - started) / 60000);
      if (minutes >= 15) {
        needsAttention.push({
          type: 'kitchen_delay',
          text: `Table ${t.table_number || t.order_number} has been waiting ${minutes} min on food`,
        });
      }
    }
    for (const b of unpaidBills || []) {
      const minutes = Math.round((now - new Date(b.created_at).getTime()) / 60000);
      needsAttention.push({
        type: 'unpaid_bill',
        text: `Bill ${b.bill_number}${b.table_number ? ` (Table ${b.table_number})` : ''} is unpaid${minutes > 0 ? ` — ${minutes} min` : ''}`,
      });
    }
    for (const r of soonReservations || []) {
      const when = r.date && r.time ? new Date(`${r.date}T${r.time.length === 5 ? r.time + ':00' : r.time}`) : null;
      if (!when || Number.isNaN(when.getTime())) continue;
      const diffMin = Math.round((when.getTime() - now) / 60000);
      if (diffMin >= -5 && diffMin <= 30) {
        needsAttention.push({
          type: 'reservation_soon',
          text: diffMin <= 0
            ? `${r.name} (party of ${r.party_size || r.guests || '—'}) has arrived for their reservation`
            : `${r.name} (party of ${r.party_size || r.guests || '—'}) arrives in ${diffMin} min`,
        });
      }
    }

    // Today's Activity — merge real event sources, most recent first.
    const activity = [];
    for (const o of recentOrders || []) {
      activity.push({ type: 'order_created', text: `Order ${o.order_number} created${o.table_number ? ` for Table ${o.table_number}` : ''}`, at: o.created_at });
    }
    for (const k of completedTickets || []) {
      activity.push({ type: 'kitchen_ready', text: `Kitchen ticket ready${k.table_number ? ` for Table ${k.table_number}` : ''}`, at: k.completed_at });
    }
    for (const r of checkedInReservations || []) {
      activity.push({ type: 'reservation_checked_in', text: `${r.name} checked in`, at: r.checked_in_at });
    }
    for (const m of recentMovements || []) {
      const label =
        m.change_type === 'wastage'
          ? 'Wastage logged'
          : ['manual_restock', 'purchase_receipt', 'opening_balance'].includes(m.change_type)
            ? 'Stock restocked'
            : 'Stock adjusted';
      activity.push({ type: m.change_type, text: `${label}: ${m.item_name || 'item'} (${m.quantity_changed > 0 ? '+' : ''}${m.quantity_changed})`, at: m.created_at });
    }
    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const activityTrimmed = activity.slice(0, 20).map((a) => ({ ...a, atLabel: formatNepalDateTime(a.at) }));

    // Business overview — last 7 days revenue + order volume.
    const byDate = new Map((dailyBills || []).map((r) => [dateKey(r.d), { revenue: n(r.revenue), orders: n(r.orders) }]));
    const revenueTrend = [];
    const orderVolume = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = nepalDateString(d);
      const dayName = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short' });
      const row = byDate.get(dateStr) || { revenue: 0, orders: 0 };
      revenueTrend.push({ day: dayName, date: dateStr, value: row.revenue });
      orderVolume.push({ day: dayName, date: dateStr, value: row.orders });
    }

    // Reservation snapshot (today).
    let reservationSnapshot = null;
    try {
      const [upcoming, waiting, cancelled] = await Promise.all([
        db.get(`SELECT COUNT(*) as c FROM reservations WHERE date = ? AND status IN ('new', 'confirmed')`, [today]),
        db.get(`SELECT COUNT(*) as c FROM reservations WHERE date = ? AND status = 'arrived'`, [today]),
        db.get(`SELECT COUNT(*) as c FROM reservations WHERE date = ? AND status = 'cancelled'`, [today]),
      ]);
      reservationSnapshot = { upcoming: n(upcoming?.c), waiting: n(waiting?.c), cancelled: n(cancelled?.c) };
    } catch {
      reservationSnapshot = null; // reservations table not present — omit the section client-side
    }

    return NextResponse.json({
      stats: {
        today,
        kpis: {
          sales: { value: sales, prev: prevSales },
          orders: { value: orders, prev: prevOrders },
          profit: { value: profit, prev: prevProfit },
          occupiedTables: { value: n(occupiedRow?.c), total: n(totalTablesRow?.c) },
        },
        needsAttention: needsAttention.slice(0, 8),
        activity: activityTrimmed,
        revenueTrend,
        orderVolume,
        performance: {
          topItem: topItemToday?.[0] ? { name: topItemToday[0].name, qty: n(topItemToday[0].qty) } : null,
          bestEmployee: bestEmployeeToday ? { name: bestEmployeeToday.name, orders: n(bestEmployeeToday.c) } : null,
          busiestTable: busiestTableToday ? { table: busiestTableToday.table_number, orders: n(busiestTableToday.c) } : null,
        },
        inventorySnapshot: (lowStockItems || []).map((i) => ({
          name: i.name,
          qty: n(i.quantity),
          unit: i.unit || '',
          status: n(i.quantity) <= 0 ? 'out' : 'low',
        })),
        reservations: reservationSnapshot,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
