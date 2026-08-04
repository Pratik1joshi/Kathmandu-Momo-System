/**
 * Analytics engine behind /admin/reports.
 *
 * One builder per tab. Every number returned here comes from a real query —
 * where this schema has no underlying data for a metric the owner asked for
 * (tips, attendance, supplier ledgers, refunds) the metric is left out rather
 * than faked, and the tab carries a `notes` line saying so.
 *
 * SQL is written SQLite-first; lib/db/sql.js#adaptSqlForPostgres translates it.
 * Never write `x::text` / `x::date` here — use CAST(x AS TEXT) and date(x).
 */

import { nepalDateString } from '@/lib/report-dates.js';

// ponytail: flat food-cost ratio for menu items without a recipe/BOM — same
// heuristic the dashboard already uses. Real cost comes from recipes when present.
export const COST_RATIO = 0.6;

const PAID = `COALESCE(b.status, 'paid') = 'paid'`;
const LIVE_ITEM = `COALESCE(oi.status, '') NOT IN ('voided', 'cancelled')`;

/** Postgres lowercases unquoted aliases; read a numeric field either way. */
export function num(row, ...keys) {
  if (!row) return 0;
  for (const key of keys) {
    const v = row[key] ?? row[key.toLowerCase()];
    if (v != null && v !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** Rounded rupees with thousand separators, for insight and chip copy. */
const money = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const isPg = (db) => db?.driver === 'postgres';

/* ---- detail-table capping ---------------------------------------- */
/*
 * The detail tables used to end in a bare `LIMIT 500`, which meant a busy month
 * quietly showed the newest 500 rows and said nothing about the rest — the
 * owner had no way to tell a complete list from a cut-off one, and the CSV was
 * cut off too.
 *
 * Now the cap is explicit: query one row past it to detect that more exists,
 * report `truncated` and the real `total` on the table so the UI can say so,
 * and let `exportAll` lift the cap entirely so a download is always complete.
 */
export const DETAIL_LIMIT = 500;
const MAX_DETAIL_LIMIT = 5000;

/** null means "no cap" (export). */
function detailCap(f) {
  if (f?.exportAll) return null;
  const asked = Number(f?.detailLimit);
  return Number.isFinite(asked) && asked > 0 ? Math.min(asked, MAX_DETAIL_LIMIT) : DETAIL_LIMIT;
}

/** `LIMIT cap + 1` — the extra row is the "there is more" probe. */
function capClause(cap) {
  return cap == null ? '' : `LIMIT ${cap + 1}`;
}

/** Trim the probe row and say whether it was there. */
function capRows(rows, cap) {
  const list = rows || [];
  if (cap == null || list.length <= cap) return { rows: list, truncated: false };
  return { rows: list.slice(0, cap), truncated: true };
}

/**
 * Fold the cap result into a table payload so every tab reports truncation the
 * same way. `shown` / `truncated` are what the UI reads.
 */
function withCap(table, capped, cap) {
  return {
    ...table,
    rows: capped.rows,
    shown: capped.rows.length,
    truncated: capped.truncated,
    limit: cap,
  };
}

/* ---- dialect helpers the SQL adapter does not cover ---- */
const hourOf = (db, col) =>
  isPg(db) ? `CAST(EXTRACT(HOUR FROM ${col}) AS INTEGER)` : `CAST(strftime('%H', ${col}) AS INTEGER)`;
const dowOf = (db, col) =>
  isPg(db) ? `CAST(EXTRACT(DOW FROM ${col}) AS INTEGER)` : `CAST(strftime('%w', ${col}) AS INTEGER)`;
const monthOf = (db, col) =>
  isPg(db) ? `to_char(${col}, 'YYYY-MM')` : `strftime('%Y-%m', ${col})`;
/** Whole minutes between two timestamp columns. */
const minutesBetween = (a, b) => `((julianday(${b}) - julianday(${a})) * 1440.0)`;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/**
 * Normalise a grouped `date(col)` value to YYYY-MM-DD.
 * node-postgres hands back a JS Date for the `date` type, so String(v).slice(0,10)
 * gives "Wed Jul 01" and every by-day chart silently flatlines. SQLite returns a
 * plain string. Handle both.
 */
export const dateKey = (v) => {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v ?? '').slice(0, 10);
};

/** Every date in the range, ascending, as { date, day } — used to pad chart series. */
export function eachDay(range) {
  const out = [];
  const cursor = new Date(`${range.start}T12:00:00+05:45`);
  const last = new Date(`${range.end}T12:00:00+05:45`);
  let guard = 0;
  while (cursor <= last && guard++ < 400) {
    out.push({
      date: nepalDateString(cursor),
      day: cursor.toLocaleDateString('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short' }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** The equal-length window immediately before `range`, for "vs previous" maths. */
export function previousRange(range) {
  const start = new Date(`${range.start}T12:00:00+05:45`);
  const end = new Date(`${range.end}T12:00:00+05:45`);
  const span = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (span - 1));
  return { start: nepalDateString(prevStart), end: nepalDateString(prevEnd), spanDays: span };
}

function pctChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Filter fragment shared by every bill-scoped query.
 * Assumes the query aliases bills as `b` and orders as `o`.
 */
function billScope(range, f = {}) {
  let sql = ` WHERE date(b.created_at) BETWEEN ? AND ? AND ${PAID}`;
  const params = [range.start, range.end];

  if (f.employeeId) {
    sql += ` AND (o.waiter_id = ? OR b.cashier_id = ?)`;
    params.push(f.employeeId, f.employeeId);
  }
  if (f.orderType) {
    sql += ` AND COALESCE(o.order_type, 'dine_in') = ?`;
    params.push(f.orderType);
  }
  if (f.paymentMethod) {
    sql += ` AND EXISTS (SELECT 1 FROM bill_payments bpf WHERE bpf.bill_id = b.id AND bpf.payment_method = ?)`;
    params.push(f.paymentMethod);
  }
  if (f.categoryId) {
    sql += ` AND EXISTS (
      SELECT 1 FROM order_items oif
      JOIN menu_items mif ON COALESCE(oif.menu_item_id, oif.item_id) = mif.id
      WHERE oif.order_id = o.id AND mif.category_id = ?
    )`;
    params.push(f.categoryId);
  }
  if (f.search) {
    sql += ` AND (LOWER(COALESCE(b.bill_number, '')) LIKE ?
                OR LOWER(COALESCE(o.order_number, '')) LIKE ?
                OR LOWER(COALESCE(o.table_number, '')) LIKE ?
                OR LOWER(COALESCE(o.customer_name, '')) LIKE ?)`;
    const like = `%${String(f.search).toLowerCase()}%`;
    params.push(like, like, like, like);
  }
  return { sql, params };
}

const BILL_FROM = `FROM bills b JOIN orders o ON b.order_id = o.id`;

/* ------------------------------------------------------------------ */
/* Shared building blocks                                             */
/* ------------------------------------------------------------------ */

/**
 * menu_item_id -> unit food cost. Recipe/BOM cost when a recipe exists,
 * otherwise base_price * COST_RATIO. `estimated` flags the fallback.
 */
export async function getItemCostMap(db) {
  const items = await db.all(`SELECT id, base_price FROM menu_items`);
  const map = new Map();
  for (const item of items || []) {
    map.set(item.id, { cost: num(item, 'base_price') * COST_RATIO, estimated: true });
  }

  // Single flat query: recipe -> raw-material lines priced at current cost.
  // Sub-recipe components are ignored here (a nested BOM needs explodeRecipe,
  // which is per-recipe and far heavier); flagged as estimated when incomplete.
  const rows = await db.all(`
    SELECT r.menu_item_id AS menu_item_id,
           COALESCE(r.yield_quantity, 1) AS yield_quantity,
           SUM(COALESCE(ri.quantity, 0) * COALESCE(im.cost_per_unit, 0)) AS cost,
           SUM(CASE WHEN ri.component_recipe_id IS NOT NULL THEN 1 ELSE 0 END) AS nested
    FROM recipes r
    JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN inventory_items im ON ri.raw_material_id = im.id
    WHERE r.menu_item_id IS NOT NULL
    GROUP BY r.menu_item_id, r.yield_quantity
  `);
  for (const row of rows || []) {
    const yieldQty = num(row, 'yield_quantity') || 1;
    const cost = num(row, 'cost') / yieldQty;
    if (cost > 0) map.set(row.menu_item_id, { cost, estimated: num(row, 'nested') > 0 });
  }
  return map;
}

/** Per-menu-item sales aggregate for the selected range. */
async function itemSales(db, range, f) {
  const scope = billScope(range, f);
  return db.all(
    `
    SELECT COALESCE(oi.menu_item_id, oi.item_id) AS menu_item_id,
           COALESCE(oi.item_name, mi.name, 'Item') AS name,
           mi.image_url AS image_url,
           mi.base_price AS base_price,
           mc.name AS category_name,
           mc.id AS category_id,
           SUM(oi.quantity) AS quantity,
           SUM(COALESCE(oi.subtotal, oi.quantity * COALESCE(oi.price, 0))) AS revenue
    ${BILL_FROM}
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN menu_items mi ON COALESCE(oi.menu_item_id, oi.item_id) = mi.id
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    ${scope.sql} AND ${LIVE_ITEM}
    GROUP BY COALESCE(oi.menu_item_id, oi.item_id), COALESCE(oi.item_name, mi.name, 'Item'),
             mi.image_url, mi.base_price, mc.name, mc.id
    ORDER BY revenue DESC
  `,
    scope.params
  );
}

/** Daily revenue/orders/cost series padded across the whole range. */
async function dailySeries(db, range, f, costMap) {
  const scope = billScope(range, f);
  const rows = await db.all(
    `SELECT date(b.created_at) AS d, COUNT(DISTINCT b.id) AS orders,
            COALESCE(SUM(b.grand_total), 0) AS revenue
     ${BILL_FROM}${scope.sql}
     GROUP BY date(b.created_at)`,
    scope.params
  );
  const byDate = new Map((rows || []).map((r) => [dateKey(r.d), r]));

  // Food cost per day, so the profit trend is not a flat multiple of revenue.
  const costRows = await db.all(
    `SELECT date(b.created_at) AS d, COALESCE(oi.menu_item_id, oi.item_id) AS menu_item_id,
            SUM(oi.quantity) AS quantity,
            SUM(COALESCE(oi.subtotal, oi.quantity * COALESCE(oi.price, 0))) AS revenue
     ${BILL_FROM}
     JOIN order_items oi ON oi.order_id = o.id
     ${scope.sql} AND ${LIVE_ITEM}
     GROUP BY date(b.created_at), COALESCE(oi.menu_item_id, oi.item_id)`,
    scope.params
  );
  const costByDate = new Map();
  for (const row of costRows || []) {
    const key = dateKey(row.d);
    const entry = costMap?.get(row.menu_item_id);
    const cost = entry ? entry.cost * num(row, 'quantity') : num(row, 'revenue') * COST_RATIO;
    costByDate.set(key, (costByDate.get(key) || 0) + cost);
  }

  return eachDay(range).map(({ date, day }) => {
    const row = byDate.get(date);
    const revenue = num(row, 'revenue');
    const cost = costByDate.get(date) || 0;
    return { date, day, revenue, orders: num(row, 'orders'), cost, profit: revenue - cost };
  });
}

async function expenseTotals(db, range) {
  const rows = await db.all(
    `SELECT COALESCE(category, 'other') AS category, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
     FROM expenses
     WHERE COALESCE(purchase_date, CAST(expense_date AS TEXT)) BETWEEN ? AND ?
     GROUP BY COALESCE(category, 'other')
     ORDER BY amount DESC`,
    [range.start, range.end]
  );
  const total = (rows || []).reduce((s, r) => s + num(r, 'amount'), 0);
  return { rows: rows || [], total };
}

/* ------------------------------------------------------------------ */
/* Tab builders                                                        */
/* ------------------------------------------------------------------ */

async function overviewTab(db, range, f) {
  const costMap = await getItemCostMap(db);
  const prev = previousRange(range);
  const scope = billScope(range, f);

  const [summary, prevSummary, series, items, expenses] = await Promise.all([
    db.get(
      `SELECT COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
       ${BILL_FROM}${scope.sql}`,
      scope.params
    ),
    (async () => {
      const p = billScope(prev, f);
      return db.get(
        `SELECT COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
         ${BILL_FROM}${p.sql}`,
        p.params
      );
    })(),
    dailySeries(db, range, f, costMap),
    itemSales(db, range, f),
    expenseTotals(db, range),
  ]);

  const revenue = num(summary, 'revenue');
  const orders = num(summary, 'orders');
  const cost = series.reduce((s, d) => s + d.cost, 0);
  const profit = revenue - cost;
  const prevRevenue = num(prevSummary, 'revenue');

  const alerts = await db.all(
    `SELECT id, COALESCE(item_name, name) AS item_name, quantity, unit,
            COALESCE(min_stock_level, min_stock, 0) AS min_level
     FROM inventory_items
     WHERE COALESCE(quantity, 0) <= COALESCE(min_stock_level, min_stock, 0)
     ORDER BY quantity ASC
     LIMIT 8`
  );

  const activity = await db.all(
    `SELECT b.bill_number, b.grand_total, b.created_at, o.order_number, o.table_number,
            u.full_name AS waiter_name
     ${BILL_FROM}
     LEFT JOIN users u ON o.waiter_id = u.id
     ${scope.sql}
     ORDER BY b.created_at DESC
     LIMIT 12`,
    scope.params
  );

  const busiestHour = await topHour(db, range, f);
  const chips = [];
  const revChange = pctChange(revenue, prevRevenue);
  if (revChange != null) {
    chips.push({ icon: revChange >= 0 ? 'up' : 'down', text: `Revenue ${revChange >= 0 ? 'up' : 'down'} ${Math.abs(revChange)}% vs the previous ${prev.spanDays} day(s)` });
  } else if (revenue > 0) {
    chips.push({ icon: 'up', text: `${money(revenue)} earned — nothing was billed in the previous period` });
  }
  if (items?.[0]) {
    chips.push({ icon: 'star', text: `${items[0].name} generated the most revenue (${money(num(items[0], 'revenue'))})` });
  }
  if (busiestHour) {
    chips.push({ icon: 'clock', text: `${busiestHour.label} accounted for ${busiestHour.share}% of sales` });
  }

  const insights = [];
  if (revenue > 0) {
    insights.push({
      title: 'Margin health',
      body: `Estimated gross margin is ${((profit / revenue) * 100).toFixed(1)}% after food cost of ${money(cost)}.`,
      tone: profit / revenue > 0.3 ? 'positive' : 'warning',
    });
  }
  if (expenses.total > 0) {
    insights.push({
      title: 'Operating expenses',
      body: `${money(expenses.total)} of expenses were logged, led by ${expenses.rows[0]?.category?.replace(/_/g, ' ')} (${money(num(expenses.rows[0], 'amount'))}).`,
      tone: 'neutral',
    });
  }
  if (orders > 0) {
    const best = [...series].sort((a, b) => b.revenue - a.revenue)[0];
    if (best && best.revenue > 0) {
      insights.push({ title: 'Strongest day', body: `${best.day} ${best.date} brought in ${money(best.revenue)} across ${best.orders} order(s).`, tone: 'positive' });
    }
  }
  if ((alerts || []).length) {
    insights.push({ title: 'Stock needs attention', body: `${alerts.length} raw material(s) are at or below their reorder level.`, tone: 'warning' });
  }

  return {
    chips,
    kpis: [
      { key: 'revenue', label: 'Revenue', value: revenue, format: 'currency', change: revChange },
      { key: 'profit', label: 'Gross Profit (est.)', value: profit, format: 'currency' },
      { key: 'orders', label: 'Orders', value: orders, format: 'number', change: pctChange(orders, num(prevSummary, 'orders')) },
      { key: 'aov', label: 'Average Order', value: orders ? revenue / orders : 0, format: 'currency' },
    ],
    charts: {
      revenueTrend: series.map((d) => ({ label: d.day, sub: d.date, value: d.revenue })),
      profitTrend: series.map((d) => ({ label: d.day, sub: d.date, value: d.profit })),
      topItems: (items || []).slice(0, 8).map((i) => ({ label: i.name, value: num(i, 'revenue'), meta: `${num(i, 'quantity')} sold` })),
    },
    insights,
    alerts: (alerts || []).map((a) => ({
      name: a.item_name,
      quantity: num(a, 'quantity'),
      unit: a.unit || '',
      status: num(a, 'quantity') <= 0 ? 'out' : 'low',
    })),
    table: {
      title: 'Recent Activity',
      columns: [
        { key: 'created_at', label: 'Time', type: 'datetime' },
        { key: 'bill_number', label: 'Bill' },
        { key: 'order_number', label: 'Order' },
        { key: 'table_number', label: 'Table' },
        { key: 'waiter_name', label: 'Waiter' },
        { key: 'grand_total', label: 'Amount', type: 'currency', align: 'right' },
      ],
      rows: (activity || []).map((r) => ({
        created_at: r.created_at,
        bill_number: r.bill_number,
        order_number: r.order_number,
        table_number: r.table_number || '—',
        waiter_name: r.waiter_name || 'Unassigned',
        grand_total: num(r, 'grand_total'),
      })),
      empty: 'No bills were settled in the selected period.',
    },
  };
}

/** Busiest sales hour in the range, as { label, share } — used for a quick chip. */
async function topHour(db, range, f) {
  const scope = billScope(range, f);
  const rows = await db.all(
    `SELECT ${hourOf(db, 'b.created_at')} AS hour, COALESCE(SUM(b.grand_total), 0) AS revenue
     ${BILL_FROM}${scope.sql}
     GROUP BY ${hourOf(db, 'b.created_at')}
     ORDER BY revenue DESC`,
    scope.params
  );
  if (!rows?.length) return null;
  const total = rows.reduce((s, r) => s + num(r, 'revenue'), 0);
  if (!total) return null;
  const top = rows[0];
  const h = num(top, 'hour');
  const fmt = (n) => `${((n + 11) % 12) + 1}${n < 12 ? 'AM' : 'PM'}`;
  return { label: `${fmt(h)}–${fmt((h + 1) % 24)}`, share: Math.round((num(top, 'revenue') / total) * 100) };
}

async function salesTab(db, range, f) {
  const cap = detailCap(f);
  const costMap = await getItemCostMap(db);
  const scope = billScope(range, f);

  const [totals, series, byHour, byDow, byCategory, byPayment, byWaiter, byType, invoices, cancelled] =
    await Promise.all([
      db.get(
        `SELECT COALESCE(SUM(b.subtotal), 0) AS gross,
                COALESCE(SUM(b.grand_total), 0) AS net,
                COALESCE(SUM(COALESCE(b.tax, 0) + COALESCE(b.vat_amount, 0)), 0) AS tax,
                COALESCE(SUM(b.discount_amount), 0) AS discounts,
                COALESCE(SUM(b.service_charge), 0) AS service_charge,
                COUNT(DISTINCT b.id) AS orders
         ${BILL_FROM}${scope.sql}`,
        scope.params
      ),
      dailySeries(db, range, f, costMap),
      db.all(
        `SELECT ${hourOf(db, 'b.created_at')} AS hour, COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
         ${BILL_FROM}${scope.sql} GROUP BY ${hourOf(db, 'b.created_at')} ORDER BY hour ASC`,
        scope.params
      ),
      db.all(
        `SELECT ${dowOf(db, 'b.created_at')} AS dow, COALESCE(SUM(b.grand_total), 0) AS revenue
         ${BILL_FROM}${scope.sql} GROUP BY ${dowOf(db, 'b.created_at')} ORDER BY dow ASC`,
        scope.params
      ),
      db.all(
        `SELECT COALESCE(mc.name, 'Uncategorised') AS category,
                SUM(COALESCE(oi.subtotal, oi.quantity * COALESCE(oi.price, 0))) AS revenue,
                SUM(oi.quantity) AS quantity
         ${BILL_FROM}
         JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN menu_items mi ON COALESCE(oi.menu_item_id, oi.item_id) = mi.id
         LEFT JOIN menu_categories mc ON mi.category_id = mc.id
         ${scope.sql} AND ${LIVE_ITEM}
         GROUP BY COALESCE(mc.name, 'Uncategorised')
         ORDER BY revenue DESC`,
        scope.params
      ),
      db.all(
        `SELECT COALESCE(bp.payment_method, 'other') AS method, COUNT(*) AS count, COALESCE(SUM(bp.amount), 0) AS amount
         ${BILL_FROM}
         JOIN bill_payments bp ON bp.bill_id = b.id
         ${scope.sql}
         GROUP BY COALESCE(bp.payment_method, 'other')
         ORDER BY amount DESC`,
        scope.params
      ),
      db.all(
        `SELECT COALESCE(u.full_name, 'Unassigned') AS waiter, COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
         ${BILL_FROM}
         LEFT JOIN users u ON o.waiter_id = u.id
         ${scope.sql}
         GROUP BY COALESCE(u.full_name, 'Unassigned')
         ORDER BY revenue DESC`,
        scope.params
      ),
      db.all(
        `SELECT COALESCE(o.order_type, 'dine_in') AS order_type, COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
         ${BILL_FROM}${scope.sql}
         GROUP BY COALESCE(o.order_type, 'dine_in')
         ORDER BY revenue DESC`,
        scope.params
      ),
      db.all(
        `SELECT b.id AS bill_id, b.bill_number, b.grand_total, b.created_at,
                o.order_number, o.table_number, o.customer_name,
                COALESCE(cu.full_name, '—') AS cashier,
                (SELECT GROUP_CONCAT(payment_method, ', ') FROM bill_payments bp2 WHERE bp2.bill_id = b.id) AS payment
         ${BILL_FROM}
         LEFT JOIN users cu ON b.cashier_id = cu.id
         ${scope.sql}
         ORDER BY b.created_at DESC
         ${capClause(cap)}`,
        scope.params
      ),
      db.get(
        `SELECT COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(COALESCE(oi.subtotal, oi.quantity * COALESCE(oi.price, 0))), 0) AS value
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE date(o.created_at) BETWEEN ? AND ? AND o.status = 'cancelled'`,
        [range.start, range.end]
      ),
    ]);

  const invoicesCapped = capRows(invoices, cap);

  const gross = num(totals, 'gross');
  const net = num(totals, 'net');
  const tax = num(totals, 'tax');
  const orders = num(totals, 'orders');
  const paymentTotal = (byPayment || []).reduce((s, r) => s + num(r, 'amount'), 0) || 1;
  const busiestHour = await topHour(db, range, f);

  const chips = [];
  if (busiestHour) chips.push({ icon: 'clock', text: `${busiestHour.label} accounted for ${busiestHour.share}% of sales` });
  if (byCategory?.[0]) chips.push({ icon: 'star', text: `${byCategory[0].category} is the strongest category at ${money(num(byCategory[0], 'revenue'))}` });
  if (byPayment?.[0]) chips.push({ icon: 'card', text: `${byPayment[0].method} covers ${Math.round((num(byPayment[0], 'amount') / paymentTotal) * 100)}% of payment value` });

  const insights = [];
  if (byWaiter?.[0] && byWaiter[0].waiter !== 'Unassigned') {
    insights.push({ title: 'Top server', body: `${byWaiter[0].waiter} closed ${num(byWaiter[0], 'orders')} order(s) worth ${money(num(byWaiter[0], 'revenue'))}.`, tone: 'positive' });
  }
  if (tax > 0) {
    insights.push({ title: 'Tax collected', body: `${money(tax)} of tax sits inside ${money(net)} of billed value — ${((tax / net) * 100).toFixed(1)}% of the total.`, tone: 'neutral' });
  }
  if (num(totals, 'discounts') === 0 && orders > 0) {
    insights.push({ title: 'No discounting', body: 'Not a single bill in this period carried a discount, so headline sales equal realised sales.', tone: 'neutral' });
  }
  if (num(cancelled, 'orders') > 0) {
    insights.push({ title: 'Cancelled orders', body: `${num(cancelled, 'orders')} order(s) worth about ${money(num(cancelled, 'value'))} were cancelled before billing.`, tone: 'warning' });
  }
  const quietest = (byHour || []).slice().sort((a, b) => num(a, 'revenue') - num(b, 'revenue'))[0];
  if (quietest && (byHour || []).length > 2) {
    const h = num(quietest, 'hour');
    insights.push({ title: 'Quietest trading hour', body: `${((h + 11) % 12) + 1}${h < 12 ? 'AM' : 'PM'} is the slowest hour, taking just ${money(num(quietest, 'revenue'))}.`, tone: 'neutral' });
  }

  return {
    chips,
    kpis: [
      { key: 'gross', label: 'Gross Sales', value: gross, format: 'currency' },
      { key: 'net', label: 'Net Sales', value: net - tax, format: 'currency' },
      { key: 'tax', label: 'Tax Collected', value: tax, format: 'currency' },
      { key: 'discounts', label: 'Discounts', value: num(totals, 'discounts'), format: 'currency' },
      { key: 'cancelled', label: 'Cancelled Value', value: num(cancelled, 'value'), format: 'currency' },
      { key: 'aov', label: 'Average Order', value: orders ? net / orders : 0, format: 'currency' },
    ],
    charts: {
      revenueTrend: series.map((d) => ({ label: d.day, sub: d.date, value: d.revenue })),
      byHour: (byHour || []).map((r) => {
        const h = num(r, 'hour');
        return { label: `${String(h).padStart(2, '0')}:00`, value: num(r, 'revenue'), meta: `${num(r, 'orders')} orders` };
      }),
      byDay: (byDow || []).map((r) => ({ label: DAY_NAMES[num(r, 'dow')] || '—', value: num(r, 'revenue') })),
      byCategory: (byCategory || []).map((r) => ({ label: r.category, value: num(r, 'revenue'), meta: `${num(r, 'quantity')} sold` })),
      byPayment: (byPayment || []).map((r) => ({ label: r.method, value: num(r, 'amount'), meta: `${num(r, 'count')} txns` })),
      byWaiter: (byWaiter || []).map((r) => ({ label: r.waiter, value: num(r, 'revenue'), meta: `${num(r, 'orders')} orders` })),
      byOrderType: (byType || []).map((r) => ({ label: r.order_type.replace(/_/g, ' '), value: num(r, 'revenue'), meta: `${num(r, 'orders')} orders` })),
    },
    insights,
    table: {
      title: 'Invoices',
      truncated: invoicesCapped.truncated,
      limit: cap,
      columns: [
        { key: 'created_at', label: 'Date', type: 'datetime' },
        { key: 'bill_number', label: 'Invoice' },
        { key: 'order_number', label: 'Order' },
        { key: 'cashier', label: 'Cashier' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'payment', label: 'Payment', type: 'badge' },
        { key: 'grand_total', label: 'Amount', type: 'currency', align: 'right' },
      ],
      rows: invoicesCapped.rows.map((r) => ({
        created_at: r.created_at,
        bill_number: r.bill_number,
        order_number: r.order_number || '—',
        cashier: r.cashier || '—',
        customer_name: r.customer_name || 'Walk-in',
        payment: r.payment || '—',
        grand_total: num(r, 'grand_total'),
      })),
      empty: 'No invoices were raised in the selected period.',
    },
    notes: [
      'This build has no refund or void-after-payment workflow, so the Refunds KPI is replaced by the value of orders cancelled before billing.',
    ],
  };
}

async function financeTab(db, range, f) {
  const cap = detailCap(f);
  const costMap = await getItemCostMap(db);
  const scope = billScope(range, f);

  const [revenueRow, series, expenses, ledger, monthly, expenseDaily, taxDaily, vatRows] = await Promise.all([
    db.get(`SELECT COALESCE(SUM(b.grand_total), 0) AS revenue ${BILL_FROM}${scope.sql}`, scope.params),
    dailySeries(db, range, f, costMap),
    expenseTotals(db, range),
    db.all(
      `SELECT e.id, e.description, e.category, e.amount, e.supplier, e.payment_method,
              COALESCE(e.purchase_date, CAST(e.expense_date AS TEXT)) AS spent_on,
              u.full_name AS logged_by_name
       FROM expenses e
       LEFT JOIN users u ON e.logged_by = u.id
       WHERE COALESCE(e.purchase_date, CAST(e.expense_date AS TEXT)) BETWEEN ? AND ?
       ORDER BY COALESCE(e.purchase_date, CAST(e.expense_date AS TEXT)) DESC
       ${capClause(cap)}`,
      [range.start, range.end]
    ),
    db.all(
      `SELECT ${monthOf(db, 'b.created_at')} AS month, COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
       FROM bills b JOIN orders o ON b.order_id = o.id
       WHERE ${PAID}
       GROUP BY ${monthOf(db, 'b.created_at')}
       ORDER BY month ASC
       LIMIT 24`
    ),
    db.all(
      `SELECT COALESCE(purchase_date, CAST(expense_date AS TEXT)) AS d, COALESCE(SUM(amount), 0) AS amount
       FROM expenses
       WHERE COALESCE(purchase_date, CAST(expense_date AS TEXT)) BETWEEN ? AND ?
       GROUP BY COALESCE(purchase_date, CAST(expense_date AS TEXT))`,
      [range.start, range.end]
    ),
    db.all(
      `SELECT date(b.created_at) AS d,
              COALESCE(SUM(b.subtotal), 0) AS subtotal,
              COALESCE(SUM(b.tax), 0) AS tax,
              COALESCE(SUM(b.vat_amount), 0) AS vat,
              COALESCE(SUM(b.service_charge), 0) AS service_charge,
              COALESCE(SUM(b.discount_amount), 0) AS discount
       ${BILL_FROM}${scope.sql}
       GROUP BY date(b.created_at)
       ORDER BY d DESC`,
      scope.params
    ),
    db.all(
      `SELECT b.bill_number, b.created_at, b.subtotal, b.vat_amount, b.tax_percent, b.grand_total
       ${BILL_FROM}${scope.sql} AND COALESCE(b.vat_amount, 0) > 0
       ORDER BY b.created_at DESC
       ${capClause(cap)}`,
      scope.params
    ),
  ]);

  const vatCapped = capRows(vatRows, cap);
  const ledgerCapped = capRows(ledger, cap);

  const revenue = num(revenueRow, 'revenue');
  const profit = revenue - expenses.total;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const expenseByDate = new Map((expenseDaily || []).map((r) => [dateKey(r.d), num(r, 'amount')]));
  const profitSeries = series.map((d) => ({
    ...d,
    expenses: expenseByDate.get(d.date) || 0,
    netProfit: d.revenue - (expenseByDate.get(d.date) || 0),
  }));

  const chips = [];
  chips.push({ icon: margin >= 0 ? 'up' : 'down', text: `Net margin is ${margin.toFixed(1)}% after ${money(expenses.total)} of expenses` });
  if (expenses.rows[0]) {
    chips.push({ icon: 'wallet', text: `${String(expenses.rows[0].category).replace(/_/g, ' ')} is the largest expense line (${money(num(expenses.rows[0], 'amount'))})` });
  }
  const bestProfitDay = [...profitSeries].sort((a, b) => b.netProfit - a.netProfit)[0];
  if (bestProfitDay) chips.push({ icon: 'star', text: `${bestProfitDay.day} ${bestProfitDay.date} was the most profitable day (${money(bestProfitDay.netProfit)})` });

  const insights = [];
  const foodCost = series.reduce((s, d) => s + d.cost, 0);
  if (revenue > 0) {
    insights.push({ title: 'Food cost share', body: `Estimated food cost is ${money(foodCost)}, or ${((foodCost / revenue) * 100).toFixed(1)}% of revenue.`, tone: foodCost / revenue > 0.4 ? 'warning' : 'positive' });
  }
  if (expenses.total > 0) {
    insights.push({ title: 'Expense concentration', body: `The top expense category makes up ${Math.round((num(expenses.rows[0], 'amount') / expenses.total) * 100)}% of everything spent this period.`, tone: 'neutral' });
  }
  const lossDays = profitSeries.filter((d) => d.netProfit < 0).length;
  if (lossDays > 0) insights.push({ title: 'Days in the red', body: `${lossDays} day(s) in this range spent more than they earned.`, tone: 'warning' });
  if (!vatRows?.length) insights.push({ title: 'VAT not in use', body: 'No bill in this period carried a separate VAT amount — tax is booked through the single tax field.', tone: 'neutral' });

  return {
    chips,
    kpis: [
      { key: 'revenue', label: 'Revenue', value: revenue, format: 'currency' },
      { key: 'expenses', label: 'Expenses', value: expenses.total, format: 'currency' },
      { key: 'profit', label: 'Profit', value: profit, format: 'currency' },
      { key: 'margin', label: 'Profit Margin', value: margin, format: 'percent' },
    ],
    charts: {
      expenseBreakdown: expenses.rows.map((r) => ({ label: String(r.category).replace(/_/g, ' '), value: num(r, 'amount'), meta: `${num(r, 'count')} entries` })),
      profitTrend: profitSeries.map((d) => ({ label: d.day, sub: d.date, value: d.netProfit })),
      monthlyRevenue: (monthly || []).map((r) => ({ label: r.month, value: num(r, 'revenue'), meta: `${num(r, 'orders')} orders` })),
      expenseTrend: profitSeries.map((d) => ({ label: d.day, sub: d.date, value: d.expenses })),
    },
    insights,
    tables: [
      {
        id: 'ledger',
        title: 'Expense Ledger',
        truncated: ledgerCapped.truncated,
        limit: cap,
        columns: [
          { key: 'spent_on', label: 'Date' },
          { key: 'description', label: 'Description' },
          { key: 'category', label: 'Category', type: 'badge' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'payment_method', label: 'Paid by' },
          { key: 'logged_by_name', label: 'Logged by' },
          { key: 'amount', label: 'Amount', type: 'currency', align: 'right' },
        ],
        rows: ledgerCapped.rows.map((r) => ({
          spent_on: r.spent_on,
          description: r.description || '—',
          category: String(r.category || 'other').replace(/_/g, ' '),
          supplier: r.supplier || '—',
          payment_method: r.payment_method || 'cash',
          logged_by_name: r.logged_by_name || '—',
          amount: num(r, 'amount'),
        })),
        empty: 'No expenses were recorded in the selected period.',
      },
      {
        id: 'profit-summary',
        title: 'Profit Summary',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'revenue', label: 'Revenue', type: 'currency', align: 'right' },
          { key: 'expenses', label: 'Expenses', type: 'currency', align: 'right' },
          { key: 'netProfit', label: 'Profit', type: 'currency', align: 'right' },
          { key: 'marginPct', label: 'Margin', type: 'percent', align: 'right' },
        ],
        rows: profitSeries.map((d) => ({
          date: d.date,
          revenue: d.revenue,
          expenses: d.expenses,
          netProfit: d.netProfit,
          marginPct: d.revenue ? (d.netProfit / d.revenue) * 100 : 0,
        })),
        empty: 'There is no trading history to summarise for this period.',
      },
      {
        id: 'tax-summary',
        title: 'Tax Summary',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'subtotal', label: 'Taxable Base', type: 'currency', align: 'right' },
          { key: 'tax', label: 'Tax', type: 'currency', align: 'right' },
          { key: 'service_charge', label: 'Service Charge', type: 'currency', align: 'right' },
          { key: 'discount', label: 'Discounts', type: 'currency', align: 'right' },
        ],
        rows: (taxDaily || []).map((r) => ({
          date: dateKey(r.d),
          subtotal: num(r, 'subtotal'),
          tax: num(r, 'tax'),
          service_charge: num(r, 'service_charge'),
          discount: num(r, 'discount'),
        })),
        empty: 'No tax has been charged in the selected period.',
      },
      {
        id: 'vat',
        title: 'VAT Report',
        truncated: vatCapped.truncated,
        limit: cap,
        columns: [
          { key: 'created_at', label: 'Date', type: 'datetime' },
          { key: 'bill_number', label: 'Bill' },
          { key: 'subtotal', label: 'Net', type: 'currency', align: 'right' },
          { key: 'vat_amount', label: 'VAT', type: 'currency', align: 'right' },
          { key: 'grand_total', label: 'Gross', type: 'currency', align: 'right' },
        ],
        rows: vatCapped.rows.map((r) => ({
          created_at: r.created_at,
          bill_number: r.bill_number,
          subtotal: num(r, 'subtotal'),
          vat_amount: num(r, 'vat_amount'),
          grand_total: num(r, 'grand_total'),
        })),
        empty: 'No bill in this period carried a separate VAT amount.',
      },
    ],
    notes: ['Profit here is revenue minus recorded operating expenses. The food-cost figure quoted in insights is estimated from recipes where they exist and a 60% cost ratio elsewhere.'],
  };
}

async function ordersTab(db, range, f) {
  const cap = detailCap(f);
  const orderScope = ` WHERE date(o.created_at) BETWEEN ? AND ?`;
  const orderParams = [range.start, range.end];
  const extra = [];
  if (f.employeeId) { extra.push(` AND o.waiter_id = ?`); orderParams.push(f.employeeId); }
  if (f.orderType) { extra.push(` AND COALESCE(o.order_type, 'dine_in') = ?`); orderParams.push(f.orderType); }
  if (f.search) {
    extra.push(` AND (LOWER(COALESCE(o.order_number, '')) LIKE ? OR LOWER(COALESCE(o.table_number, '')) LIKE ?)`);
    const like = `%${String(f.search).toLowerCase()}%`;
    orderParams.push(like, like);
  }
  const where = orderScope + extra.join('');

  const [statusRows, byHour, prep, serve, byType, rows] = await Promise.all([
    db.all(`SELECT COALESCE(o.status, 'pending') AS status, COUNT(*) AS count FROM orders o${where} GROUP BY COALESCE(o.status, 'pending')`, orderParams),
    db.all(
      `SELECT ${hourOf(db, 'o.created_at')} AS hour, COUNT(*) AS count FROM orders o${where}
       GROUP BY ${hourOf(db, 'o.created_at')} ORDER BY hour ASC`,
      orderParams
    ),
    db.all(
      `SELECT o.id AS order_id, ${minutesBetween('k.printed_at', 'k.completed_at')} AS minutes
       FROM orders o JOIN kots k ON k.order_id = o.id
       ${where} AND k.completed_at IS NOT NULL`,
      orderParams
    ),
    db.all(
      `SELECT o.id AS order_id, ${minutesBetween('o.created_at', 'b.paid_at')} AS minutes
       FROM orders o JOIN bills b ON b.order_id = o.id
       ${where} AND ${PAID} AND b.paid_at IS NOT NULL`,
      orderParams
    ),
    db.all(`SELECT COALESCE(o.order_type, 'dine_in') AS order_type, COUNT(*) AS count FROM orders o${where} GROUP BY COALESCE(o.order_type, 'dine_in')`, orderParams),
    db.all(
      `SELECT o.id, o.order_number, o.status, o.order_type, o.table_number, o.created_at,
              u.full_name AS waiter_name,
              (SELECT MIN(${minutesBetween('k2.printed_at', 'k2.completed_at')}) FROM kots k2 WHERE k2.order_id = o.id AND k2.completed_at IS NOT NULL) AS kitchen_minutes,
              (SELECT MAX(k3.completed_at) FROM kots k3 WHERE k3.order_id = o.id) AS kitchen_done_at,
              (SELECT MAX(b2.created_at) FROM bills b2 WHERE b2.order_id = o.id) AS completed_at,
              (SELECT COALESCE(SUM(COALESCE(oi.subtotal, oi.quantity * COALESCE(oi.price, 0))), 0)
                 FROM order_items oi WHERE oi.order_id = o.id AND ${LIVE_ITEM}) AS order_value
       FROM orders o
       LEFT JOIN users u ON o.waiter_id = u.id
       ${where}
       ORDER BY o.created_at DESC
       ${capClause(cap)}`,
      orderParams
    ),
  ]);

  const rowsCapped = capRows(rows, cap);

  const counts = {};
  for (const r of statusRows || []) counts[r.status] = num(r, 'count');
  const totalOrders = Object.values(counts).reduce((s, n) => s + n, 0);
  const avg = (list) => (list.length ? list.reduce((s, n) => s + n, 0) / list.length : 0);
  const prepMinutes = (prep || []).map((r) => num(r, 'minutes')).filter((n) => n > 0 && n < 600);
  const serveMinutes = (serve || []).map((r) => num(r, 'minutes')).filter((n) => n > 0 && n < 600);

  const chips = [];
  if (totalOrders) {
    const done = counts.completed || 0;
    chips.push({ icon: 'up', text: `${Math.round((done / totalOrders) * 100)}% of orders reached completion (${done} of ${totalOrders})` });
  }
  if (prepMinutes.length) chips.push({ icon: 'clock', text: `Kitchen turns a ticket around in ${avg(prepMinutes).toFixed(0)} minutes on average` });
  const peak = (byHour || []).slice().sort((a, b) => num(b, 'count') - num(a, 'count'))[0];
  if (peak) chips.push({ icon: 'clock', text: `${String(num(peak, 'hour')).padStart(2, '0')}:00 is the busiest hour with ${num(peak, 'count')} orders` });

  const insights = [];
  if (serveMinutes.length) insights.push({ title: 'Table to bill', body: `An order takes ${avg(serveMinutes).toFixed(0)} minutes on average from being placed to being billed.`, tone: 'neutral' });
  if (prepMinutes.length) {
    const slow = prepMinutes.filter((m) => m > 25).length;
    insights.push({ title: 'Slow tickets', body: `${slow} kitchen ticket(s) took longer than 25 minutes.`, tone: slow > 0 ? 'warning' : 'positive' });
  }
  const open = (counts.pending || 0) + (counts.preparing || 0) + (counts.ready || 0);
  if (open > 0) insights.push({ title: 'Still open', body: `${open} order(s) from this period have not been closed out yet.`, tone: 'warning' });
  if (counts.cancelled) insights.push({ title: 'Cancellations', body: `${counts.cancelled} order(s) were cancelled — ${Math.round((counts.cancelled / totalOrders) * 100)}% of the period.`, tone: 'warning' });

  // Prep-time distribution buckets, so the chart says something a raw list cannot.
  const buckets = [
    { label: '0–10 min', test: (m) => m <= 10 },
    { label: '11–20 min', test: (m) => m > 10 && m <= 20 },
    { label: '21–30 min', test: (m) => m > 20 && m <= 30 },
    { label: '31–45 min', test: (m) => m > 30 && m <= 45 },
    { label: '45+ min', test: (m) => m > 45 },
  ];

  return {
    chips,
    kpis: [
      { key: 'completed', label: 'Completed', value: counts.completed || 0, format: 'number', tone: 'positive' },
      { key: 'preparing', label: 'Preparing', value: counts.preparing || 0, format: 'number', tone: 'warning' },
      { key: 'ready', label: 'Ready', value: counts.ready || 0, format: 'number', tone: 'info' },
      { key: 'pending', label: 'Pending', value: counts.pending || 0, format: 'number', tone: 'neutral' },
      { key: 'cancelled', label: 'Cancelled', value: counts.cancelled || 0, format: 'number', tone: 'negative' },
    ],
    charts: {
      perHour: (byHour || []).map((r) => ({ label: `${String(num(r, 'hour')).padStart(2, '0')}:00`, value: num(r, 'count') })),
      prepTime: buckets.map((b) => ({ label: b.label, value: prepMinutes.filter(b.test).length })),
      serveTime: buckets.map((b) => ({ label: b.label, value: serveMinutes.filter(b.test).length })),
      orderTypes: (byType || []).map((r) => ({ label: r.order_type.replace(/_/g, ' '), value: num(r, 'count') })),
    },
    insights,
    table: {
      title: 'Orders',
      truncated: rowsCapped.truncated,
      limit: cap,
      columns: [
        { key: 'created_at', label: 'Placed', type: 'datetime' },
        { key: 'order_number', label: 'Order' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'table_number', label: 'Table' },
        { key: 'waiter_name', label: 'Waiter' },
        { key: 'kitchen_minutes', label: 'Kitchen (min)', type: 'number', align: 'right' },
        { key: 'completed_at', label: 'Completed', type: 'datetime' },
        { key: 'order_value', label: 'Value', type: 'currency', align: 'right' },
      ],
      rows: rowsCapped.rows.map((r) => ({
        created_at: r.created_at,
        order_number: r.order_number,
        status: r.status || 'pending',
        table_number: r.table_number || '—',
        waiter_name: r.waiter_name || 'Unassigned',
        kitchen_minutes: r.kitchen_minutes == null ? null : Math.round(num(r, 'kitchen_minutes')),
        completed_at: r.completed_at || null,
        order_value: num(r, 'order_value'),
      })),
      empty: 'No orders were placed in the selected period.',
    },
  };
}

async function menuTab(db, range, f) {
  const costMap = await getItemCostMap(db);
  const sold = await itemSales(db, range, f);
  const soldById = new Map((sold || []).map((r) => [r.menu_item_id, r]));

  const allItems = await db.all(
    `SELECT mi.id, mi.name, mi.base_price, mi.image_url, mi.is_available,
            COALESCE(mc.name, 'Uncategorised') AS category_name
     FROM menu_items mi
     LEFT JOIN menu_categories mc ON mi.category_id = mc.id
     ORDER BY mi.name ASC`
  );

  const rows = (allItems || []).map((item) => {
    const s = soldById.get(item.id);
    const quantity = num(s, 'quantity');
    const revenue = num(s, 'revenue');
    const entry = costMap.get(item.id);
    const unitCost = entry ? entry.cost : num(item, 'base_price') * COST_RATIO;
    const foodCost = unitCost * quantity;
    const profit = revenue - foodCost;
    return {
      id: item.id,
      name: item.name,
      category_name: item.category_name,
      quantity,
      revenue,
      food_cost: foodCost,
      profit,
      margin: revenue ? (profit / revenue) * 100 : 0,
      avg_price: quantity ? revenue / quantity : num(item, 'base_price'),
      costed_from_recipe: !!(entry && !entry.estimated),
    };
  });

  const withSales = rows.filter((r) => r.quantity > 0);
  const best = withSales.slice().sort((a, b) => b.quantity - a.quantity)[0] || null;
  const worst = withSales.slice().sort((a, b) => a.quantity - b.quantity)[0] || null;
  const topProfit = withSales.slice().sort((a, b) => b.profit - a.profit)[0] || null;
  const lowProfit = withSales.slice().sort((a, b) => a.profit - b.profit)[0] || null;
  const neverSold = rows.filter((r) => r.quantity === 0).length;

  const byCategory = new Map();
  for (const r of withSales) {
    const prev = byCategory.get(r.category_name) || { revenue: 0, quantity: 0, profit: 0, items: 0 };
    prev.revenue += r.revenue;
    prev.quantity += r.quantity;
    prev.profit += r.profit;
    prev.items += 1;
    byCategory.set(r.category_name, prev);
  }
  const categoryRows = Array.from(byCategory.entries())
    .map(([name, v]) => ({ label: name, value: v.revenue, meta: `${v.quantity} sold`, ...v }))
    .sort((a, b) => b.value - a.value);

  const chips = [];
  if (best) chips.push({ icon: 'star', text: `${best.name} is the best seller with ${best.quantity} sold` });
  if (topProfit) chips.push({ icon: 'up', text: `${topProfit.name} contributed the most profit (${money(topProfit.profit)})` });
  if (neverSold) chips.push({ icon: 'info', text: `${neverSold} of ${rows.length} menu items sold nothing in this period` });

  const insights = [];
  if (categoryRows[0]) {
    const total = categoryRows.reduce((s, c) => s + c.revenue, 0) || 1;
    insights.push({ title: 'Category concentration', body: `${categoryRows[0].label} alone produced ${Math.round((categoryRows[0].revenue / total) * 100)}% of menu revenue.`, tone: 'neutral' });
  }
  if (lowProfit && lowProfit.margin < 30) {
    insights.push({ title: 'Thin margin', body: `${lowProfit.name} runs at a ${lowProfit.margin.toFixed(1)}% margin — worth a price or portion review.`, tone: 'warning' });
  }
  if (neverSold > rows.length * 0.4) {
    insights.push({ title: 'Menu drag', body: `${neverSold} items had no sales at all. A shorter menu would cut prep waste and speed up service.`, tone: 'warning' });
  }
  const recipeCosted = rows.filter((r) => r.costed_from_recipe).length;
  insights.push({
    title: 'Cost accuracy',
    body: recipeCosted
      ? `${recipeCosted} item(s) are costed from a real recipe; the rest use the ${COST_RATIO * 100}% food-cost estimate.`
      : `No menu item has a complete recipe yet, so every food cost here is the ${COST_RATIO * 100}% estimate. Add recipes to make these margins exact.`,
    tone: recipeCosted ? 'neutral' : 'warning',
  });

  return {
    chips,
    kpis: [
      { key: 'best', label: 'Best Seller', value: best?.name || null, format: 'text', sub: best ? `${best.quantity} sold` : null },
      { key: 'worst', label: 'Worst Seller', value: worst?.name || null, format: 'text', sub: worst ? `${worst.quantity} sold` : null },
      { key: 'topProfit', label: 'Highest Profit Item', value: topProfit?.name || null, format: 'text', sub: topProfit ? `${money(topProfit.profit)}` : null },
      { key: 'lowProfit', label: 'Lowest Profit Item', value: lowProfit?.name || null, format: 'text', sub: lowProfit ? `${money(lowProfit.profit)}` : null },
    ],
    charts: {
      topItems: withSales.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 10)
        .map((r) => ({ label: r.name, value: r.revenue, meta: `${r.quantity} sold` })),
      categoryPerformance: categoryRows.map((c) => ({ label: c.label, value: c.value, meta: c.meta })),
      avgPrice: categoryRows.map((c) => ({ label: c.label, value: c.quantity ? c.revenue / c.quantity : 0 })),
      matrix: withSales.map((r) => ({ label: r.name, x: r.quantity, y: r.margin, size: r.revenue })),
    },
    insights,
    table: {
      title: 'Menu Performance',
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'category_name', label: 'Category', type: 'badge' },
        { key: 'quantity', label: 'Qty Sold', type: 'number', align: 'right' },
        { key: 'revenue', label: 'Revenue', type: 'currency', align: 'right' },
        { key: 'food_cost', label: 'Food Cost', type: 'currency', align: 'right' },
        { key: 'profit', label: 'Profit', type: 'currency', align: 'right' },
        { key: 'margin', label: 'Margin', type: 'percent', align: 'right' },
      ],
      rows,
      empty: 'No menu items have been created yet.',
    },
  };
}

async function inventoryTab(db, range, f) {
  const cap = detailCap(f);
  const params = [range.start, range.end];
  const [items, movements, movementDaily, wastageDaily, byType] = await Promise.all([
    db.all(
      `SELECT id, COALESCE(item_name, name) AS item_name, quantity, unit, cost_per_unit,
              COALESCE(min_stock_level, min_stock, 0) AS min_level, supplier, category
       FROM inventory_items
       ORDER BY COALESCE(item_name, name) ASC`
    ),
    db.all(
      // 'manual_restock' is the pre-008 name for 'purchase_receipt'; folded
      // here so one filter covers old and new history. cost basis comes from
      // the movement when it has one, so historical value never gets rewritten
      // by a later price change.
      `SELECT m.id,
              CASE WHEN m.change_type = 'manual_restock' THEN 'purchase_receipt' ELSE m.change_type END AS change_type,
              m.quantity_changed, m.reason, m.created_at,
              COALESCE(im.item_name, im.name) AS item_name, im.unit,
              COALESCE(m.unit_cost, im.cost_per_unit) AS cost_per_unit,
              u.full_name AS performed_by_name
       FROM stock_movements m
       LEFT JOIN inventory_items im ON m.inventory_item_id = im.id
       LEFT JOIN users u ON m.performed_by = u.id
       WHERE date(m.created_at) BETWEEN ? AND ?
       ORDER BY m.created_at DESC
       ${capClause(cap)}`,
      params
    ),
    db.all(
      `SELECT date(m.created_at) AS d,
              CASE WHEN m.change_type = 'manual_restock' THEN 'purchase_receipt' ELSE m.change_type END AS change_type,
              SUM(ABS(m.quantity_changed) * COALESCE(m.unit_cost, im.cost_per_unit, 0)) AS value
       FROM stock_movements m
       LEFT JOIN inventory_items im ON m.inventory_item_id = im.id
       WHERE date(m.created_at) BETWEEN ? AND ?
       GROUP BY date(m.created_at),
                CASE WHEN m.change_type = 'manual_restock' THEN 'purchase_receipt' ELSE m.change_type END`,
      params
    ),
    db.all(
      `SELECT date(w.created_at) AS d, SUM(w.quantity * COALESCE(im.cost_per_unit, 0)) AS value
       FROM wastage_log w
       LEFT JOIN inventory_items im ON w.raw_material_id = im.id
       WHERE date(w.created_at) BETWEEN ? AND ?
       GROUP BY date(w.created_at)`,
      params
    ),
    db.all(
      `SELECT change_type, COUNT(*) AS count, SUM(ABS(quantity_changed)) AS quantity
       FROM stock_movements
       WHERE date(created_at) BETWEEN ? AND ?
       GROUP BY change_type`,
      params
    ),
  ]);

  const movementsCapped = capRows(movements, cap);

  const inventoryValue = (items || []).reduce((s, i) => s + num(i, 'quantity') * num(i, 'cost_per_unit'), 0);
  const outOfStock = (items || []).filter((i) => num(i, 'quantity') <= 0);
  const lowStock = (items || []).filter((i) => num(i, 'quantity') > 0 && num(i, 'quantity') <= num(i, 'min_level'));
  // Off the unbounded daily aggregate, not the capped detail rows — otherwise
  // this understates wastage the moment the detail table is truncated.
  const wastageCost = (wastageDaily || []).reduce((s, w) => s + num(w, 'value'), 0);

  const days = eachDay(range);
  const seriesFor = (rowsIn, filterType) => {
    const map = new Map();
    for (const r of rowsIn || []) {
      if (filterType && r.change_type !== filterType) continue;
      const k = dateKey(r.d);
      map.set(k, (map.get(k) || 0) + num(r, 'value'));
    }
    return days.map((d) => ({ label: d.day, sub: d.date, value: map.get(d.date) || 0 }));
  };

  const chips = [];
  chips.push({ icon: 'wallet', text: `${money(inventoryValue)} of stock is sitting on the shelves right now` });
  if (outOfStock.length || lowStock.length) {
    chips.push({ icon: 'warn', text: `${outOfStock.length} item(s) out of stock and ${lowStock.length} running low` });
  } else if (items?.length) {
    chips.push({ icon: 'up', text: 'Every tracked raw material is above its reorder level' });
  }
  const priciest = (items || []).slice().sort((a, b) => num(b, 'quantity') * num(b, 'cost_per_unit') - num(a, 'quantity') * num(a, 'cost_per_unit'))[0];
  if (priciest) chips.push({ icon: 'star', text: `${priciest.item_name} ties up the most capital (${money((num(priciest, 'quantity') * num(priciest, 'cost_per_unit')))})` });

  const insights = [];
  if (!movements?.length) {
    insights.push({ title: 'No movement history yet', body: 'Nothing has been received, deducted or adjusted in this period, so consumption and purchase trends have no data to draw from. Movement rows appear once deliveries are received or orders deduct stock.', tone: 'neutral' });
  }
  if (lowStock.length) {
    insights.push({ title: 'Reorder queue', body: `${lowStock.map((i) => i.item_name).slice(0, 3).join(', ')}${lowStock.length > 3 ? ` and ${lowStock.length - 3} more` : ''} need restocking.`, tone: 'warning' });
  }
  if (wastageCost > 0) {
    insights.push({ title: 'Wastage cost', body: `${money(wastageCost)} was written off in this period.`, tone: 'warning' });
  }
  const noSupplier = (items || []).filter((i) => !i.supplier).length;
  if (noSupplier) insights.push({ title: 'Missing supplier data', body: `${noSupplier} of ${items.length} raw materials have no supplier recorded, which limits purchase analysis.`, tone: 'neutral' });

  return {
    chips,
    kpis: [
      { key: 'value', label: 'Inventory Value', value: inventoryValue, format: 'currency' },
      { key: 'low', label: 'Low Stock', value: lowStock.length, format: 'number', tone: 'warning' },
      { key: 'out', label: 'Out of Stock', value: outOfStock.length, format: 'number', tone: 'negative' },
      { key: 'wastage', label: 'Wastage Cost', value: wastageCost, format: 'currency' },
    ],
    charts: {
      consumption: seriesFor(movementDaily, 'order_deduction'),
      purchases: seriesFor(movementDaily, 'purchase_receipt'),
      wastage: (() => {
        const map = new Map((wastageDaily || []).map((r) => [dateKey(r.d), num(r, 'value')]));
        return days.map((d) => ({ label: d.day, sub: d.date, value: map.get(d.date) || 0 }));
      })(),
      movementTypes: (byType || []).map((r) => ({ label: String(r.change_type).replace(/_/g, ' '), value: num(r, 'quantity'), meta: `${num(r, 'count')} entries` })),
    },
    insights,
    tables: [
      {
        id: 'inventory',
        title: 'Inventory',
        columns: [
          { key: 'item_name', label: 'Item' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'quantity', label: 'Current Stock', type: 'number', align: 'right' },
          { key: 'unit', label: 'Unit' },
          { key: 'min_level', label: 'Minimum Stock', type: 'number', align: 'right' },
          { key: 'value', label: 'Value', type: 'currency', align: 'right' },
          { key: 'stock_status', label: 'Status', type: 'status' },
        ],
        rows: (items || []).map((i) => ({
          item_name: i.item_name,
          supplier: i.supplier || '—',
          quantity: num(i, 'quantity'),
          unit: i.unit || '',
          min_level: num(i, 'min_level'),
          value: num(i, 'quantity') * num(i, 'cost_per_unit'),
          stock_status: num(i, 'quantity') <= 0 ? 'out of stock' : num(i, 'quantity') <= num(i, 'min_level') ? 'low' : 'ok',
        })),
        empty: 'No raw materials have been added to inventory yet.',
      },
      {
        id: 'movements',
        title: 'Movement History',
        truncated: movementsCapped.truncated,
        limit: cap,
        columns: [
          { key: 'created_at', label: 'When', type: 'datetime' },
          { key: 'item_name', label: 'Item' },
          { key: 'change_type', label: 'Type', type: 'badge' },
          { key: 'quantity_changed', label: 'Change', type: 'number', align: 'right' },
          { key: 'reason', label: 'Reason' },
          { key: 'performed_by_name', label: 'By' },
        ],
        rows: movementsCapped.rows.map((m) => ({
          created_at: m.created_at,
          item_name: m.item_name || '—',
          change_type: String(m.change_type || '').replace(/_/g, ' '),
          quantity_changed: num(m, 'quantity_changed'),
          reason: m.reason || '—',
          performed_by_name: m.performed_by_name || 'System',
        })),
        empty: 'No inventory movement has been recorded in this period.',
      },
      {
        id: 'purchases',
        title: 'Purchase History',
        truncated: movementsCapped.truncated,
        limit: cap,
        columns: [
          { key: 'created_at', label: 'Received', type: 'datetime' },
          { key: 'item_name', label: 'Item' },
          { key: 'quantity_changed', label: 'Quantity', type: 'number', align: 'right' },
          { key: 'value', label: 'Value', type: 'currency', align: 'right' },
          { key: 'performed_by_name', label: 'Received by' },
        ],
        rows: movementsCapped.rows
          .filter((m) => m.change_type === 'purchase_receipt')
          .map((m) => ({
            created_at: m.created_at,
            item_name: m.item_name || '—',
            quantity_changed: num(m, 'quantity_changed'),
            value: Math.abs(num(m, 'quantity_changed')) * num(m, 'cost_per_unit'),
            performed_by_name: m.performed_by_name || 'System',
          })),
        empty: 'No deliveries have been received in this period.',
      },
      {
        id: 'low-stock',
        title: 'Low Stock Items',
        columns: [
          { key: 'item_name', label: 'Item' },
          { key: 'quantity', label: 'Remaining', type: 'number', align: 'right' },
          { key: 'min_level', label: 'Minimum', type: 'number', align: 'right' },
          { key: 'shortfall', label: 'Shortfall', type: 'number', align: 'right' },
          { key: 'supplier', label: 'Supplier' },
        ],
        rows: [...outOfStock, ...lowStock].map((i) => ({
          item_name: i.item_name,
          quantity: num(i, 'quantity'),
          min_level: num(i, 'min_level'),
          shortfall: Math.max(0, num(i, 'min_level') - num(i, 'quantity')),
          supplier: i.supplier || '—',
        })),
        empty: 'Every tracked raw material is above its reorder level.',
      },
    ],
  };
}

async function customersTab(db, range, f) {
  const scope = billScope(range, f);
  const [customers, linked, growth, walkIns] = await Promise.all([
    db.all(`SELECT id, name, phone, total_visits, total_spent, is_vip, created_at FROM customers ORDER BY total_spent DESC`),
    db.all(
      `SELECT o.customer_id AS customer_id, COUNT(DISTINCT b.id) AS orders,
              COALESCE(SUM(b.grand_total), 0) AS spend, MAX(b.created_at) AS last_visit
       ${BILL_FROM}${scope.sql} AND o.customer_id IS NOT NULL
       GROUP BY o.customer_id`,
      scope.params
    ),
    db.all(
      `SELECT date(created_at) AS d, COUNT(*) AS count FROM customers
       WHERE date(created_at) BETWEEN ? AND ?
       GROUP BY date(created_at)`,
      [range.start, range.end]
    ),
    db.get(
      `SELECT COUNT(DISTINCT b.id) AS orders, COALESCE(SUM(b.grand_total), 0) AS revenue
       ${BILL_FROM}${scope.sql} AND o.customer_id IS NULL`,
      scope.params
    ),
  ]);

  const linkedById = new Map((linked || []).map((r) => [r.customer_id, r]));
  const rows = (customers || []).map((c) => {
    const l = linkedById.get(c.id);
    return {
      name: c.name,
      phone: c.phone || '—',
      is_vip: num(c, 'is_vip') ? 'VIP' : 'Regular',
      orders: num(c, 'total_visits'),
      spending: num(c, 'total_spent'),
      lifetime_value: num(c, 'total_spent'),
      avg_spend: num(c, 'total_visits') ? num(c, 'total_spent') / num(c, 'total_visits') : 0,
      last_visit: l?.last_visit || null,
      period_spend: num(l, 'spend'),
    };
  });

  const newInRange = (growth || []).reduce((s, r) => s + num(r, 'count'), 0);
  const returning = rows.filter((r) => r.orders > 1).length;
  const vip = rows.filter((r) => r.is_vip === 'VIP').length;
  const avgSpend = rows.length ? rows.reduce((s, r) => s + r.avg_spend, 0) / rows.length : 0;
  const unlinked = (linked || []).length === 0;

  const chips = [];
  chips.push({ icon: 'info', text: `${rows.length} customer profile(s) on file, ${returning} of them repeat visitors` });
  if (rows[0]) chips.push({ icon: 'star', text: `${rows[0].name} is the highest lifetime spender at ${money(rows[0].spending)}` });
  if (unlinked && num(walkIns, 'orders') > 0) {
    chips.push({ icon: 'warn', text: `All ${num(walkIns, 'orders')} billed orders this period were walk-ins with no customer attached` });
  }

  const insights = [];
  if (unlinked) {
    insights.push({
      title: 'Orders are not linked to customers',
      body: 'Every order in this period was taken as a walk-in, so per-customer revenue, visit frequency and last-visit dates cannot be derived from trading data. The figures below come from the customer profiles themselves.',
      tone: 'warning',
    });
  }
  if (vip) insights.push({ title: 'VIP base', body: `${vip} customer(s) are flagged VIP, worth ${money(rows.filter((r) => r.is_vip === 'VIP').reduce((s, r) => s + r.spending, 0))} in lifetime spend.`, tone: 'positive' });
  if (rows.length) {
    const top3 = rows.slice(0, 3).reduce((s, r) => s + r.spending, 0);
    const all = rows.reduce((s, r) => s + r.spending, 0) || 1;
    insights.push({ title: 'Spend concentration', body: `The top three customers account for ${Math.round((top3 / all) * 100)}% of all recorded customer spend.`, tone: 'neutral' });
  }
  if (newInRange === 0) insights.push({ title: 'No sign-ups', body: 'No new customer profile was created during the selected period.', tone: 'neutral' });

  const days = eachDay(range);
  const growthMap = new Map((growth || []).map((r) => [dateKey(r.d), num(r, 'count')]));

  const freqBuckets = [
    { label: '1 visit', test: (n) => n <= 1 },
    { label: '2–3 visits', test: (n) => n >= 2 && n <= 3 },
    { label: '4–6 visits', test: (n) => n >= 4 && n <= 6 },
    { label: '7+ visits', test: (n) => n >= 7 },
  ];

  return {
    chips,
    kpis: [
      { key: 'new', label: 'New Customers', value: newInRange, format: 'number' },
      { key: 'returning', label: 'Returning Customers', value: returning, format: 'number' },
      { key: 'avg', label: 'Average Spend', value: avgSpend, format: 'currency' },
      { key: 'vip', label: 'VIP Customers', value: vip, format: 'number' },
    ],
    charts: {
      growth: days.map((d) => ({ label: d.day, sub: d.date, value: growthMap.get(d.date) || 0 })),
      frequency: freqBuckets.map((b) => ({ label: b.label, value: rows.filter((r) => b.test(r.orders)).length })),
      revenueByCustomer: rows.slice(0, 10).map((r) => ({ label: r.name, value: r.spending })),
      topCustomers: rows.slice(0, 5).map((r) => ({ label: r.name, value: r.orders, meta: `${money(r.spending)} lifetime` })),
    },
    insights,
    table: {
      title: 'Customer List',
      columns: [
        { key: 'name', label: 'Customer' },
        { key: 'phone', label: 'Phone' },
        { key: 'is_vip', label: 'Tier', type: 'badge' },
        { key: 'orders', label: 'Visits', type: 'number', align: 'right' },
        { key: 'spending', label: 'Spending', type: 'currency', align: 'right' },
        { key: 'avg_spend', label: 'Avg / Visit', type: 'currency', align: 'right' },
        { key: 'last_visit', label: 'Last Visit', type: 'datetime' },
        { key: 'lifetime_value', label: 'Lifetime Value', type: 'currency', align: 'right' },
      ],
      rows,
      empty: 'No customer profiles have been created yet.',
    },
    notes: unlinked
      ? ['orders.customer_id is null on every order in this range, so Last Visit is blank and spend comes from the customer profile totals rather than from bills.']
      : [],
  };
}

async function employeesTab(db, range, f) {
  const scope = billScope(range, f);
  const [waiters, cashiers, kitchen, staff] = await Promise.all([
    db.all(
      `SELECT u.id, u.full_name, COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS orders
       ${BILL_FROM}
       JOIN users u ON o.waiter_id = u.id
       ${scope.sql}
       GROUP BY u.id, u.full_name
       ORDER BY revenue DESC`,
      scope.params
    ),
    db.all(
      `SELECT u.id, u.full_name, COALESCE(SUM(b.grand_total), 0) AS revenue, COUNT(DISTINCT b.id) AS bills
       ${BILL_FROM}
       JOIN users u ON b.cashier_id = u.id
       ${scope.sql}
       GROUP BY u.id, u.full_name
       ORDER BY revenue DESC`,
      scope.params
    ),
    db.get(
      `SELECT AVG(${minutesBetween('k.printed_at', 'k.completed_at')}) AS avg_minutes, COUNT(*) AS tickets
       FROM kots k JOIN orders o ON k.order_id = o.id
       WHERE date(k.printed_at) BETWEEN ? AND ? AND k.completed_at IS NOT NULL`,
      [range.start, range.end]
    ),
    db.all(`SELECT id, full_name, username, role FROM users WHERE COALESCE(is_active, 1) = 1 ORDER BY full_name`),
  ]);

  const revenueByStaff = new Map();
  for (const w of waiters || []) revenueByStaff.set(w.id, { revenue: num(w, 'revenue'), orders: num(w, 'orders') });
  const cashierById = new Map((cashiers || []).map((c) => [c.id, c]));

  const rows = (staff || []).map((u) => {
    const w = revenueByStaff.get(u.id);
    const c = cashierById.get(u.id);
    const revenue = (w?.revenue || 0) + (c ? num(c, 'revenue') : 0);
    const orders = (w?.orders || 0) + (c ? num(c, 'bills') : 0);
    return {
      name: u.full_name || u.username,
      role: u.role,
      served_orders: w?.orders || 0,
      served_revenue: w?.revenue || 0,
      billed_count: c ? num(c, 'bills') : 0,
      revenue,
      orders,
      avg_order: orders ? revenue / orders : 0,
    };
  });

  const topWaiter = (waiters || [])[0] || null;
  const topCashier = (cashiers || [])[0] || null;
  const topEarner = rows.slice().sort((a, b) => b.revenue - a.revenue)[0] || null;
  const avgPrep = num(kitchen, 'avg_minutes');

  const chips = [];
  if (topWaiter) chips.push({ icon: 'star', text: `${topWaiter.full_name} led the floor with ${money(num(topWaiter, 'revenue'))} served` });
  if (topCashier) chips.push({ icon: 'card', text: `${topCashier.full_name} settled ${num(topCashier, 'bills')} bill(s)` });
  if (avgPrep > 0) chips.push({ icon: 'clock', text: `Kitchen averaged ${avgPrep.toFixed(0)} minutes per ticket across ${num(kitchen, 'tickets')} tickets` });

  const insights = [];
  if ((waiters || []).length > 1) {
    const gap = num(waiters[0], 'revenue') - num(waiters[waiters.length - 1], 'revenue');
    insights.push({ title: 'Floor spread', body: `${money(gap)} separates the strongest and weakest server this period — worth checking section allocation.`, tone: 'neutral' });
  }
  if (topWaiter) {
    const total = (waiters || []).reduce((s, w) => s + num(w, 'revenue'), 0) || 1;
    insights.push({ title: 'Server concentration', body: `${topWaiter.full_name} handled ${Math.round((num(topWaiter, 'revenue') / total) * 100)}% of served revenue.`, tone: 'neutral' });
  }
  insights.push({
    title: 'Not tracked in this system',
    body: 'There is no attendance table and no tips field in this schema, so shift attendance and tip earnings cannot be reported. Kitchen tickets also carry no prepared_by user, so kitchen speed is measured per ticket rather than per cook.',
    tone: 'neutral',
  });

  const days = eachDay(range);
  const speedRows = await db.all(
    `SELECT date(k.printed_at) AS d, AVG(${minutesBetween('k.printed_at', 'k.completed_at')}) AS avg_minutes
     FROM kots k
     WHERE date(k.printed_at) BETWEEN ? AND ? AND k.completed_at IS NOT NULL
     GROUP BY date(k.printed_at)`,
    [range.start, range.end]
  );
  const speedMap = new Map((speedRows || []).map((r) => [dateKey(r.d), num(r, 'avg_minutes')]));

  return {
    chips,
    kpis: [
      { key: 'topWaiter', label: 'Top Waiter', value: topWaiter?.full_name || null, format: 'text', sub: topWaiter ? `${money(num(topWaiter, 'revenue'))}` : null },
      { key: 'topCashier', label: 'Top Cashier', value: topCashier?.full_name || null, format: 'text', sub: topCashier ? `${num(topCashier, 'bills')} bills` : null },
      { key: 'prep', label: 'Average Kitchen Time', value: avgPrep, format: 'minutes' },
      { key: 'earner', label: 'Highest Revenue Generated', value: topEarner?.name || null, format: 'text', sub: topEarner ? `${money(topEarner.revenue)}` : null },
    ],
    charts: {
      salesByWaiter: (waiters || []).map((w) => ({ label: w.full_name, value: num(w, 'revenue'), meta: `${num(w, 'orders')} orders` })),
      kitchenSpeed: days.map((d) => ({ label: d.day, sub: d.date, value: speedMap.get(d.date) || 0 })),
      orderCount: (waiters || []).map((w) => ({ label: w.full_name, value: num(w, 'orders') })),
    },
    insights,
    table: {
      title: 'Employee Performance',
      columns: [
        { key: 'name', label: 'Employee' },
        { key: 'role', label: 'Role', type: 'badge' },
        { key: 'served_orders', label: 'Orders Served', type: 'number', align: 'right' },
        { key: 'served_revenue', label: 'Revenue Served', type: 'currency', align: 'right' },
        { key: 'billed_count', label: 'Bills Settled', type: 'number', align: 'right' },
        { key: 'avg_order', label: 'Avg Order', type: 'currency', align: 'right' },
      ],
      rows,
      empty: 'No active employees are on file.',
    },
    notes: [
      'No attendance or tips data exists in this schema, so those columns and the Attendance chart are intentionally absent.',
      'kots.prepared_by is never populated, so kitchen speed is reported per ticket instead of per kitchen staff member.',
    ],
  };
}

async function tablesTab(db, range, f) {
  const scope = billScope(range, f);
  const [tables, perTable, durations, byHour] = await Promise.all([
    db.all(`SELECT id, table_number, capacity, status, section FROM tables WHERE COALESCE(is_active, 1) = 1 ORDER BY table_number`),
    db.all(
      `SELECT o.table_id AS table_id, COALESCE(o.table_number, '—') AS table_number,
              COUNT(DISTINCT b.id) AS orders, COALESCE(SUM(b.grand_total), 0) AS revenue,
              AVG(${minutesBetween('o.created_at', 'b.paid_at')}) AS avg_minutes
       ${BILL_FROM}${scope.sql}
       GROUP BY o.table_id, COALESCE(o.table_number, '—')
       ORDER BY revenue DESC`,
      scope.params
    ),
    db.all(
      `SELECT ${minutesBetween('o.created_at', 'b.paid_at')} AS minutes ${BILL_FROM}${scope.sql} AND b.paid_at IS NOT NULL`,
      scope.params
    ),
    db.all(
      `SELECT ${hourOf(db, 'o.created_at')} AS hour, COUNT(DISTINCT o.id) AS orders
       ${BILL_FROM}${scope.sql}
       GROUP BY ${hourOf(db, 'o.created_at')} ORDER BY hour ASC`,
      scope.params
    ),
  ]);

  const byTableId = new Map((perTable || []).map((r) => [r.table_id, r]));
  const dayCount = Math.max(1, eachDay(range).length);
  const totalOrders = (perTable || []).reduce((s, r) => s + num(r, 'orders'), 0);
  const maxOrdersOnATable = Math.max(1, ...(perTable || []).map((r) => num(r, 'orders')));

  const rows = (tables || []).map((t) => {
    const r = byTableId.get(t.id);
    const orders = num(r, 'orders');
    return {
      table_number: t.table_number,
      section: t.section || '—',
      capacity: num(t, 'capacity'),
      current_status: t.status || 'available',
      orders,
      revenue: num(r, 'revenue'),
      turnover: orders / dayCount,
      avg_minutes: r?.avg_minutes == null ? null : Math.round(num(r, 'avg_minutes')),
      utilisation: (orders / maxOrdersOnATable) * 100,
    };
  });

  const occupied = (tables || []).filter((t) => ['occupied', 'reserved'].includes(t.status)).length;
  const occupancy = tables?.length ? (occupied / tables.length) * 100 : 0;
  const validDurations = (durations || []).map((d) => num(d, 'minutes')).filter((m) => m > 0 && m < 600);
  const avgDining = validDurations.length ? validDurations.reduce((s, m) => s + m, 0) / validDurations.length : 0;
  const revenuePerTable = tables?.length ? rows.reduce((s, r) => s + r.revenue, 0) / tables.length : 0;

  const busiest = rows.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const quietest = rows.slice().sort((a, b) => a.orders - b.orders)[0];
  const peak = (byHour || []).slice().sort((a, b) => num(b, 'orders') - num(a, 'orders'))[0];

  const chips = [];
  if (busiest && busiest.revenue > 0) chips.push({ icon: 'star', text: `Table ${busiest.table_number} earned the most at ${money(busiest.revenue)}` });
  if (avgDining > 0) chips.push({ icon: 'clock', text: `A table is held for ${avgDining.toFixed(0)} minutes on average from order to bill` });
  if (peak) chips.push({ icon: 'clock', text: `${String(num(peak, 'hour')).padStart(2, '0')}:00 sees the highest table demand` });

  const insights = [];
  if (quietest && quietest.orders === 0) {
    const idle = rows.filter((r) => r.orders === 0);
    insights.push({ title: 'Idle tables', body: `${idle.length} table(s) took no orders at all in this period: ${idle.map((r) => r.table_number).slice(0, 5).join(', ')}.`, tone: 'warning' });
  }
  if (totalOrders && tables?.length) {
    insights.push({ title: 'Turnover', body: `Each table turned over ${(totalOrders / tables.length / dayCount).toFixed(1)} time(s) per day on average.`, tone: 'neutral' });
  }
  if (avgDining > 75) insights.push({ title: 'Long sittings', body: `An average sitting of ${avgDining.toFixed(0)} minutes limits how many covers you can serve at peak.`, tone: 'warning' });
  if (busiest && quietest && busiest.revenue > 0) {
    insights.push({ title: 'Uneven demand', body: `Table ${busiest.table_number} outsells table ${quietest.table_number} by ${money((busiest.revenue - quietest.revenue))} — check seating flow and section coverage.`, tone: 'neutral' });
  }

  return {
    chips,
    kpis: [
      { key: 'occupancy', label: 'Occupancy Now', value: occupancy, format: 'percent', sub: `${occupied} of ${tables?.length || 0} tables` },
      { key: 'turnover', label: 'Turnover / Table / Day', value: tables?.length ? totalOrders / tables.length / dayCount : 0, format: 'decimal' },
      { key: 'dining', label: 'Average Dining Time', value: avgDining || null, format: 'minutes', sub: avgDining ? 'order placed to bill settled' : 'no settled bills to measure' },
      { key: 'revenue', label: 'Revenue per Table', value: revenuePerTable, format: 'currency' },
    ],
    charts: {
      usage: rows.map((r) => ({ label: r.table_number, value: r.orders })),
      peakOccupancy: (byHour || []).map((r) => ({ label: `${String(num(r, 'hour')).padStart(2, '0')}:00`, value: num(r, 'orders') })),
      duration: rows.filter((r) => r.avg_minutes != null).map((r) => ({ label: r.table_number, value: r.avg_minutes })),
    },
    insights,
    table: {
      title: 'Table Performance',
      columns: [
        { key: 'table_number', label: 'Table' },
        { key: 'section', label: 'Section' },
        { key: 'capacity', label: 'Seats', type: 'number', align: 'right' },
        { key: 'current_status', label: 'Status', type: 'status' },
        { key: 'orders', label: 'Orders', type: 'number', align: 'right' },
        { key: 'revenue', label: 'Revenue', type: 'currency', align: 'right' },
        { key: 'avg_minutes', label: 'Avg Sitting (min)', type: 'number', align: 'right' },
        { key: 'utilisation', label: 'Utilisation', type: 'percent', align: 'right' },
      ],
      rows,
      empty: 'No tables have been set up yet.',
    },
  };
}

async function reservationsTab(db, range, f) {
  const cap = detailCap(f);
  const params = [range.start, range.end];
  const [statusRows, sourceRows, daily, hours, rows] = await Promise.all([
    db.all(`SELECT COALESCE(r.status, 'new') AS status, COUNT(*) AS count FROM reservations r WHERE r.date BETWEEN ? AND ? GROUP BY COALESCE(r.status, 'new')`, params),
    db.all(`SELECT COALESCE(r.source, 'web') AS source, COUNT(*) AS count FROM reservations r WHERE r.date BETWEEN ? AND ? GROUP BY COALESCE(r.source, 'web')`, params),
    db.all(`SELECT r.date AS d, COUNT(*) AS count FROM reservations r WHERE r.date BETWEEN ? AND ? GROUP BY r.date`, params),
    db.all(`SELECT SUBSTR(COALESCE(r.time, '00:00'), 1, 2) AS hour, COUNT(*) AS count FROM reservations r WHERE r.date BETWEEN ? AND ? GROUP BY SUBSTR(COALESCE(r.time, '00:00'), 1, 2) ORDER BY hour`, params),
    db.all(
      `SELECT r.id, r.name, r.phone, r.date, r.time, r.party_size, r.guests, r.status, r.source,
              r.checked_in_at, r.seated_at, t.table_number
       FROM reservations r
       LEFT JOIN tables t ON r.table_id = t.id
       WHERE r.date BETWEEN ? AND ?
       ORDER BY r.date DESC, r.time DESC
       ${capClause(cap)}`,
      params
    ),
  ]);

  const counts = {};
  for (const r of statusRows || []) counts[r.status] = num(r, 'count');
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const walkIns = (sourceRows || []).filter((r) => r.source !== 'web').reduce((s, r) => s + num(r, 'count'), 0);
  const noShows = counts.no_show || 0;
  const cancelled = counts.cancelled || 0;

  const chips = [];
  if (!total) {
    chips.push({ icon: 'info', text: 'The reservation book is empty for this date range' });
  } else {
    chips.push({ icon: 'info', text: `${total} booking(s) fall in this period` });
    chips.push({ icon: noShows ? 'warn' : 'up', text: `${noShows} no-show(s) — ${Math.round((noShows / total) * 100)}% of bookings` });
    const busiest = (daily || []).slice().sort((a, b) => num(b, 'count') - num(a, 'count'))[0];
    if (busiest) chips.push({ icon: 'clock', text: `${busiest.d} is the busiest booking day with ${num(busiest, 'count')} reservations` });
  }

  const insights = [];
  if (!total) {
    insights.push({
      title: 'No bookings recorded',
      body: 'The reservations book is empty for this date range. Reservations arrive through the public booking form and the Host Desk; once bookings exist, arrival hours, no-show rate and busiest days appear here.',
      tone: 'neutral',
    });
  } else {
    if (cancelled) insights.push({ title: 'Cancellations', body: `${cancelled} booking(s) were cancelled, a ${Math.round((cancelled / total) * 100)}% cancellation rate.`, tone: 'warning' });
    if (counts.completed) insights.push({ title: 'Completed sittings', body: `${counts.completed} booking(s) ran through to completion.`, tone: 'positive' });
    if (walkIns) insights.push({ title: 'Walk-in mix', body: `${walkIns} booking(s) were logged from a source other than the web form.`, tone: 'neutral' });
  }

  const reservationsCapped = capRows(rows, cap);
  const days = eachDay(range);
  const dailyMap = new Map((daily || []).map((r) => [dateKey(r.d), num(r, 'count')]));

  return {
    chips,
    kpis: [
      { key: 'reservations', label: 'Reservations', value: total, format: 'number' },
      { key: 'walkins', label: 'Walk-ins', value: walkIns, format: 'number' },
      { key: 'noshows', label: 'No Shows', value: noShows, format: 'number', tone: 'negative' },
      { key: 'cancelRate', label: 'Cancellation Rate', value: total ? (cancelled / total) * 100 : 0, format: 'percent' },
    ],
    charts: {
      trend: days.map((d) => ({ label: d.day, sub: d.date, value: dailyMap.get(d.date) || 0 })),
      arrivalHours: (hours || []).map((r) => ({ label: `${r.hour}:00`, value: num(r, 'count') })),
      busyDays: days.map((d) => ({ label: d.day, value: dailyMap.get(d.date) || 0 })),
    },
    insights,
    table: {
      title: 'Reservations',
      truncated: reservationsCapped.truncated,
      limit: cap,
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' },
        { key: 'name', label: 'Customer' },
        { key: 'party_size', label: 'Guests', type: 'number', align: 'right' },
        { key: 'status', label: 'Status', type: 'status' },
        { key: 'table_number', label: 'Assigned Table' },
        { key: 'wait_minutes', label: 'Wait (min)', type: 'number', align: 'right' },
      ],
      rows: reservationsCapped.rows.map((r) => {
        let wait = null;
        if (r.checked_in_at && r.seated_at) {
          const diff = (new Date(r.seated_at) - new Date(r.checked_in_at)) / 60000;
          if (Number.isFinite(diff) && diff >= 0) wait = Math.round(diff);
        }
        return {
          date: r.date,
          time: r.time || '—',
          name: r.name,
          party_size: num(r, 'party_size') || r.guests || 0,
          status: r.status || 'new',
          table_number: r.table_number || 'Unassigned',
          wait_minutes: wait,
        };
      }),
      empty: 'No reservations match your filters for this period.',
    },
  };
}

async function suppliersTab(db, range, f) {
  const cap = detailCap(f);
  const params = [range.start, range.end];
  const [bySupplier, daily, ledger, stocked] = await Promise.all([
    db.all(
      `SELECT COALESCE(NULLIF(TRIM(supplier), ''), 'Unattributed') AS supplier,
              COUNT(*) AS purchases, COALESCE(SUM(amount), 0) AS amount,
              MAX(COALESCE(purchase_date, CAST(expense_date AS TEXT))) AS last_purchase
       FROM expenses
       WHERE COALESCE(purchase_date, CAST(expense_date AS TEXT)) BETWEEN ? AND ?
       GROUP BY COALESCE(NULLIF(TRIM(supplier), ''), 'Unattributed')
       ORDER BY amount DESC`,
      params
    ),
    db.all(
      `SELECT COALESCE(purchase_date, CAST(expense_date AS TEXT)) AS d, COALESCE(SUM(amount), 0) AS amount
       FROM expenses
       WHERE COALESCE(purchase_date, CAST(expense_date AS TEXT)) BETWEEN ? AND ?
       GROUP BY COALESCE(purchase_date, CAST(expense_date AS TEXT))`,
      params
    ),
    db.all(
      `SELECT e.id, e.description, e.category, e.amount, e.payment_method,
              COALESCE(NULLIF(TRIM(e.supplier), ''), 'Unattributed') AS supplier,
              COALESCE(e.purchase_date, CAST(e.expense_date AS TEXT)) AS spent_on
       FROM expenses e
       WHERE COALESCE(e.purchase_date, CAST(e.expense_date AS TEXT)) BETWEEN ? AND ?
       ORDER BY COALESCE(e.purchase_date, CAST(e.expense_date AS TEXT)) DESC
       ${capClause(cap)}`,
      params
    ),
    db.all(
      `SELECT COALESCE(NULLIF(TRIM(supplier), ''), 'Unattributed') AS supplier,
              COUNT(*) AS items,
              COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)), 0) AS stock_value
       FROM inventory_items
       GROUP BY COALESCE(NULLIF(TRIM(supplier), ''), 'Unattributed')`
    ),
  ]);

  const supplierLedgerCapped = capRows(ledger, cap);
  const stockBySupplier = new Map((stocked || []).map((r) => [r.supplier, r]));
  const total = (bySupplier || []).reduce((s, r) => s + num(r, 'amount'), 0);
  const named = (bySupplier || []).filter((r) => r.supplier !== 'Unattributed');

  const chips = [];
  chips.push({ icon: 'wallet', text: `${money(total)} spent with ${named.length} supplier(s) this period` });
  if (bySupplier?.[0]) chips.push({ icon: 'star', text: `${bySupplier[0].supplier} took the largest share at ${money(num(bySupplier[0], 'amount'))}` });
  if (total && (bySupplier || []).length) chips.push({ icon: 'info', text: `Average purchase value is ${money((total / (bySupplier || []).reduce((s, r) => s + num(r, 'purchases'), 0)))}` });

  const insights = [];
  if (bySupplier?.[0] && total) {
    insights.push({ title: 'Supplier concentration', body: `${bySupplier[0].supplier} accounts for ${Math.round((num(bySupplier[0], 'amount') / total) * 100)}% of period spend — a single point of failure if they miss a delivery.`, tone: 'warning' });
  }
  const unattributedStock = stockBySupplier.get('Unattributed');
  if (unattributedStock) {
    insights.push({ title: 'Unsourced stock', body: `${num(unattributedStock, 'items')} raw material(s) worth ${money(num(unattributedStock, 'stock_value'))} have no supplier on file.`, tone: 'neutral' });
  }
  insights.push({
    title: 'Not tracked in this system',
    body: 'Suppliers are free-text fields on expenses and inventory items — there is no supplier record, invoice due date, payment status or delivery timestamp. Outstanding balances, average delivery time and price-change history therefore cannot be reported.',
    tone: 'neutral',
  });

  const days = eachDay(range);
  const dailyMap = new Map((daily || []).map((r) => [dateKey(r.d), num(r, 'amount')]));
  const purchaseCount = (bySupplier || []).reduce((s, r) => s + num(r, 'purchases'), 0);

  return {
    chips,
    kpis: [
      { key: 'purchases', label: 'Purchases', value: total, format: 'currency', sub: `${purchaseCount} entries` },
      { key: 'suppliers', label: 'Suppliers Used', value: named.length, format: 'number' },
      { key: 'avg', label: 'Average Purchase', value: purchaseCount ? total / purchaseCount : 0, format: 'currency' },
      { key: 'top', label: 'Largest Supplier', value: bySupplier?.[0]?.supplier || null, format: 'text', sub: bySupplier?.[0] ? `${money(num(bySupplier[0], 'amount'))}` : null },
    ],
    charts: {
      overTime: days.map((d) => ({ label: d.day, sub: d.date, value: dailyMap.get(d.date) || 0 })),
      spend: (bySupplier || []).map((r) => ({ label: r.supplier, value: num(r, 'amount'), meta: `${num(r, 'purchases')} purchases` })),
      topSuppliers: (bySupplier || []).slice(0, 5).map((r) => ({ label: r.supplier, value: num(r, 'purchases'), meta: `${money(num(r, 'amount'))}` })),
    },
    insights,
    tables: [
      {
        id: 'purchase-history',
        title: 'Purchase History',
        truncated: supplierLedgerCapped.truncated,
        limit: cap,
        columns: [
          { key: 'spent_on', label: 'Date' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'description', label: 'Description' },
          { key: 'category', label: 'Category', type: 'badge' },
          { key: 'payment_method', label: 'Paid by' },
          { key: 'amount', label: 'Amount', type: 'currency', align: 'right' },
        ],
        rows: supplierLedgerCapped.rows.map((r) => ({
          spent_on: r.spent_on,
          supplier: r.supplier,
          description: r.description || '—',
          category: String(r.category || 'other').replace(/_/g, ' '),
          payment_method: r.payment_method || 'cash',
          amount: num(r, 'amount'),
        })),
        empty: 'No purchases were recorded against any supplier in this period.',
      },
      {
        id: 'supplier-ledger',
        title: 'Supplier Ledger',
        columns: [
          { key: 'supplier', label: 'Supplier' },
          { key: 'purchases', label: 'Purchases', type: 'number', align: 'right' },
          { key: 'amount', label: 'Total Spend', type: 'currency', align: 'right' },
          { key: 'share', label: 'Share', type: 'percent', align: 'right' },
          { key: 'items_supplied', label: 'Items Supplied', type: 'number', align: 'right' },
          { key: 'stock_value', label: 'Stock On Hand', type: 'currency', align: 'right' },
          { key: 'last_purchase', label: 'Last Purchase' },
        ],
        rows: (bySupplier || []).map((r) => {
          const stock = stockBySupplier.get(r.supplier);
          return {
            supplier: r.supplier,
            purchases: num(r, 'purchases'),
            amount: num(r, 'amount'),
            share: total ? (num(r, 'amount') / total) * 100 : 0,
            items_supplied: num(stock, 'items'),
            stock_value: num(stock, 'stock_value'),
            last_purchase: r.last_purchase || '—',
          };
        }),
        empty: 'No supplier activity has been recorded for this period.',
      },
    ],
    notes: [
      'Outstanding Payments and Price Changes tables are omitted: expenses carry no due date, payment status or per-unit price history, so both would be fabricated.',
      'Average Delivery Time is omitted: nothing in this schema records when an order was placed with a supplier versus when it arrived.',
    ],
  };
}

/* ------------------------------------------------------------------ */

const BUILDERS = {
  overview: overviewTab,
  sales: salesTab,
  finance: financeTab,
  orders: ordersTab,
  menu: menuTab,
  inventory: inventoryTab,
  customers: customersTab,
  employees: employeesTab,
  tables: tablesTab,
  reservations: reservationsTab,
  suppliers: suppliersTab,
};

export const REPORT_TABS = Object.keys(BUILDERS);

/** Dropdown options for the shared filter bar — only filters backed by real data. */
export async function getFilterOptions(db) {
  const [employees, categories, payments, orderTypes] = await Promise.all([
    db.all(`SELECT id, full_name, username, role FROM users WHERE COALESCE(is_active, 1) = 1 ORDER BY full_name`),
    db.all(`SELECT id, name FROM menu_categories ORDER BY name`),
    db.all(`SELECT DISTINCT COALESCE(payment_method, 'other') AS method FROM bill_payments ORDER BY method`),
    db.all(`SELECT DISTINCT COALESCE(order_type, 'dine_in') AS order_type FROM orders ORDER BY order_type`),
  ]);
  return {
    employees: (employees || []).map((u) => ({ id: u.id, name: u.full_name || u.username, role: u.role })),
    categories: (categories || []).map((c) => ({ id: c.id, name: c.name })),
    paymentMethods: (payments || []).map((p) => p.method),
    orderTypes: (orderTypes || []).map((o) => o.order_type),
  };
}

export async function buildReport(db, tab, range, filters) {
  const builder = BUILDERS[tab] || BUILDERS.overview;
  return builder(db, range, filters || {});
}
