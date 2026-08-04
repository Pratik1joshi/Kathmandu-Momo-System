/**
 * Self-check for waiter analytics + order-history engines.
 * Seeds a waiter with a paid order and an open order on a throwaway DB, then
 * asserts the dashboard aggregates and the history search/scoping.
 *
 *   node scripts/check-waiter-analytics.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PosDatabase } from '../lib/db/index.js';
import { getWaiterStats } from '../lib/waiter-analytics.js';
import { searchOrderHistory } from '../lib/order-history.js';

const tmp = path.join(os.tmpdir(), `waiter-check-${Date.now()}.db`);

async function main() {
  const db = new PosDatabase(tmp);
  // Wipe demo orders/bills so only this fixture's rows are measured.
  for (const sql of [
    `DELETE FROM bill_payments`, `DELETE FROM bills`, `DELETE FROM kot_items`,
    `DELETE FROM kots`, `DELETE FROM order_items`, `DELETE FROM orders`,
  ]) {
    try { await db.run(sql); } catch { /* table may not exist */ }
  }
  await db.run(`UPDATE tables SET status = 'available', current_order_id = NULL, waiter_id = NULL`);

  const waiter = await db.get(`SELECT id FROM users WHERE role = 'waiter' ORDER BY id LIMIT 1`)
    || await db.get(`SELECT id FROM users ORDER BY id LIMIT 1`);
  const tables = await db.all(`SELECT id, table_number FROM tables ORDER BY id LIMIT 2`);
  const menu = await db.all(`SELECT id, name, base_price FROM menu_items ORDER BY id LIMIT 2`);
  const [t1, t2] = tables;

  // paid order on t1 (served today)
  const paidNo = `ORD-P-${Date.now()}`;
  const p = await db.run(
    `INSERT INTO orders (order_number, table_id, table_number, order_type, status, waiter_id, customer_name, created_at, updated_at)
     VALUES (?, ?, ?, 'dine_in', 'completed', ?, 'Ramesh', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [paidNo, t1.id, t1.table_number, waiter.id]
  );
  const paidOrder = p.lastInsertRowid;
  await db.run(
    `INSERT INTO order_items (order_id, item_id, menu_item_id, item_name, quantity, price, subtotal, status)
     VALUES (?, ?, ?, ?, 2, ?, ?, 'served')`,
    [paidOrder, menu[0].id, menu[0].id, menu[0].name, menu[0].base_price || 100, (menu[0].base_price || 100) * 2]
  );
  const billNo = `BILL-P-${Date.now()}`;
  await db.run(
    `INSERT INTO bills (bill_number, order_id, subtotal, tax, service_charge, grand_total, status, created_at, paid_at)
     VALUES (?, ?, ?, 0, 0, ?, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [billNo, paidOrder, 200, 200]
  );

  // open order on t2 (waiting on kitchen)
  const openNo = `ORD-O-${Date.now()}`;
  const o = await db.run(
    `INSERT INTO orders (order_number, table_id, table_number, order_type, status, waiter_id, created_at, updated_at)
     VALUES (?, ?, ?, 'dine_in', 'preparing', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [openNo, t2.id, t2.table_number, waiter.id]
  );
  const openOrder = o.lastInsertRowid;
  await db.run(
    `INSERT INTO order_items (order_id, item_id, menu_item_id, item_name, quantity, price, subtotal, status)
     VALUES (?, ?, ?, ?, 1, ?, ?, 'pending')`,
    [openOrder, menu[1].id, menu[1].id, menu[1].name, menu[1].base_price || 150, menu[1].base_price || 150]
  );
  await db.run(`UPDATE tables SET status = 'occupied', current_order_id = ? WHERE id = ?`, [openOrder, t2.id]);

  // --- analytics ------------------------------------------------------------
  const s = await getWaiterStats(db, { waiter_id: waiter.id });
  assert.equal(s.orders_served_today, 1, 'one paid order today');
  assert.equal(s.sales_amount, 200, 'sales = paid bill total');
  assert.equal(s.average_order_value, 200, 'AOV');
  assert.equal(s.completed_tables, 1, 'one completed');
  assert.equal(s.active_tables, 1, 'one active table');
  assert.equal(s.orders_waiting_kitchen, 1, 'open order waiting on kitchen');
  assert.equal(s.pending_tables, 1, 'pending == waiting');
  assert.equal(s.orders_delivered, 0, 'nothing delivered yet');
  assert.ok(Array.isArray(s.peak_hours), 'peak hours list');

  // scoping to a different waiter yields nothing
  const other = await getWaiterStats(db, { waiter_id: -999 });
  assert.equal(other.orders_served_today, 0, 'other waiter has no sales');

  // --- history --------------------------------------------------------------
  const active = await searchOrderHistory(db, { scope: 'active', mine: true, waiter_id: waiter.id });
  assert.ok(active.some((r) => r.order_id === openOrder), 'open order in active scope');
  assert.ok(!active.some((r) => r.order_id === paidOrder), 'completed not in active scope');

  const completed = await searchOrderHistory(db, { scope: 'completed', mine: true, waiter_id: waiter.id });
  const paidRow = completed.find((r) => r.order_id === paidOrder);
  assert.ok(paidRow, 'paid order in completed scope');
  assert.equal(paidRow.can_reopen, true, 'paid order can be reopened');
  assert.equal(paidRow.bill_number, billNo, 'history exposes the bill number');

  const byBill = await searchOrderHistory(db, { scope: 'all', q: billNo });
  assert.ok(byBill.some((r) => r.order_id === paidOrder), 'search by bill number finds it');

  const byTable = await searchOrderHistory(db, { scope: 'all', q: String(t2.table_number) });
  assert.ok(byTable.some((r) => r.order_id === openOrder), 'search by table finds the open order');

  const byCustomer = await searchOrderHistory(db, { scope: 'all', q: 'ramesh' });
  assert.ok(byCustomer.some((r) => r.order_id === paidOrder), 'search by customer name works');

  db.close();
  console.log('✓ waiter-analytics + order-history self-check passed');
}

main()
  .catch((e) => {
    console.error('✗ waiter-analytics self-check FAILED');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });
