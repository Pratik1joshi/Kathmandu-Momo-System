/**
 * Per-waiter performance snapshot for the waiter dashboard. Computed from
 * orders + paid bills. Date buckets use Nepal time (parseDbDate handles both
 * SQLite text timestamps and Postgres Date objects), so metrics match what the
 * cashier dashboard already shows. Admin (no waiter_id) gets the floor-wide roll-up.
 */

import { getNepaliDateString, parseDbDate } from './time-utils.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // 'YYYY-MM-DD HH:MM:SS' — compares correctly against SQLite text and Postgres timestamps.
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function nepaliHour(value) {
  const d = parseDbDate(value);
  if (!d) return null;
  const h = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kathmandu' }).format(d);
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? n % 24 : null;
}

export async function getWaiterStats(db, { waiter_id = null } = {}) {
  const cutoff = isoDaysAgo(2);
  const params = [cutoff];
  let waiterClause = '';
  if (waiter_id) {
    waiterClause = ' AND o.waiter_id = ?';
    params.push(waiter_id);
  }

  // Recent + all still-open orders, with their paid bill (if any).
  const rows = await db.all(
    `SELECT o.id, o.table_id, o.status, o.order_type, o.created_at, o.updated_at, o.waiter_id,
            (SELECT COALESCE(SUM(oi.subtotal), 0) FROM order_items oi
             WHERE oi.order_id = o.id AND COALESCE(oi.status, '') NOT IN ('voided', 'cancelled')) AS total_amount,
            b.grand_total AS bill_total, b.paid_at
     FROM orders o
     LEFT JOIN bills b ON b.order_id = o.id AND b.status = 'paid'
     WHERE (o.updated_at >= ? OR o.status NOT IN ('completed', 'cancelled'))${waiterClause}
     ORDER BY o.id DESC`,
    params
  );

  const today = getNepaliDateString();
  const isToday = (d) => d && getNepaliDateString(d) === today;

  const active = rows.filter((r) => !['completed', 'cancelled'].includes(String(r.status)));
  const paidToday = rows.filter((r) => r.paid_at && isToday(r.paid_at));
  const createdToday = rows.filter((r) => isToday(r.created_at));

  const sales = paidToday.reduce((s, r) => s + Number(r.bill_total ?? r.total_amount ?? 0), 0);
  const uniq = (list) => new Set(list.filter((r) => r.table_id).map((r) => r.table_id)).size;

  const WAITING = ['pending', 'confirmed', 'preparing', 'cooking'];
  const DELIVERED = ['ready', 'served', 'dining', 'awaiting_payment'];

  const byHour = {};
  for (const r of createdToday) {
    const h = nepaliHour(r.created_at);
    if (h != null) byHour[h] = (byHour[h] || 0) + 1;
  }
  const peak_hours = Object.entries(byHour)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    orders_served_today: paidToday.length,
    tables_handled: uniq(createdToday),
    sales_amount: round2(sales),
    average_order_value: paidToday.length ? round2(sales / paidToday.length) : 0,
    active_tables: uniq(active),
    pending_tables: active.filter((r) => WAITING.includes(String(r.status))).length,
    completed_tables: paidToday.length,
    orders_waiting_kitchen: active.filter((r) => WAITING.includes(String(r.status))).length,
    orders_delivered: active.filter((r) => DELIVERED.includes(String(r.status))).length,
    peak_hours,
  };
}
