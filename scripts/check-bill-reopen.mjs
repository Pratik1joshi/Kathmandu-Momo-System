/** Verify the immutable-original supplemental-bill workflow on isolated SQLite. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PosDatabase } from '../lib/db/index.js';
import { ensureAccountingSchema, postSaleJournal } from '../lib/accounting.js';
import { reopenBill, searchReopenableBills, markBillPrinted } from '../lib/bill-reopen.js';

const tmp = path.join(os.tmpdir(), `reopen-check-${Date.now()}.db`);

async function main() {
  const db = new PosDatabase(tmp);
  await ensureAccountingSchema(db);
  const table = await db.get(`SELECT id, table_number FROM tables ORDER BY id LIMIT 1`);
  const item = await db.get(`SELECT id, name, base_price FROM menu_items ORDER BY id LIMIT 1`);
  assert.ok(table && item, 'seed data provides a table and menu item');

  const orderNo = `ORD-TEST-${Date.now()}`;
  const orderResult = await db.run(
    `INSERT INTO orders (order_number, table_id, table_number, order_type, status, created_at, updated_at)
     VALUES (?, ?, ?, 'dine_in', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [orderNo, table.id, table.table_number]
  );
  const orderId = orderResult.lastInsertRowid;
  const amount = Number(item.base_price || 100);
  await db.run(
    `INSERT INTO order_items (order_id, item_id, menu_item_id, item_name, quantity, price, subtotal, status)
     VALUES (?, ?, ?, ?, 1, ?, ?, 'served')`,
    [orderId, item.id, item.id, item.name, amount, amount]
  );
  const billNo = `BILL-TEST-${Date.now()}`;
  const billResult = await db.run(
    `INSERT INTO bills (bill_number, order_id, subtotal, grand_total, status, created_at, paid_at)
     VALUES (?, ?, ?, ?, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [billNo, orderId, amount, amount]
  );
  const billId = billResult.lastInsertRowid;
  await db.run(`INSERT INTO bill_payments (bill_id, amount, payment_method) VALUES (?, ?, 'cash')`, [billId, amount]);
  await postSaleJournal(db, { bill_id: billId, bill_number: billNo, parts: [{ method: 'cash', amount }] });
  await db.run(`UPDATE tables SET status = 'available', current_order_id = NULL WHERE id = ?`, [table.id]);

  const journalBefore = await db.all(`SELECT * FROM journal_entries ORDER BY id`);
  const paymentsBefore = await db.all(`SELECT * FROM bill_payments WHERE bill_id = ?`, [billId]);
  const originalItemsBefore = await db.all(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);

  const result = await reopenBill(db, { bill_id: billId, reason: 'Customer requested one more drink' });
  assert.notEqual(Number(result.order_id), Number(orderId), 'a separate supplemental order is created');
  assert.equal(result.original_order_id, orderId, 'result retains the original order link');
  assert.equal(result.supplemental, true);

  const bill = await db.get(`SELECT * FROM bills WHERE id = ?`, [billId]);
  assert.equal(bill.status, 'paid', 'original invoice stays paid');
  assert.equal(Number(bill.reopen_count), 1);
  const originalOrder = await db.get(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  assert.equal(originalOrder.status, 'completed', 'original order stays completed');
  assert.equal(originalOrder.reopened_from_bill_id, null, 'original order is never rewritten as its own revision');

  const supplement = await db.get(`SELECT * FROM orders WHERE id = ?`, [result.order_id]);
  assert.equal(supplement.reopened_from_bill_id, billId);
  assert.equal(supplement.status, 'preparing');
  const supplementItems = await db.all(`SELECT * FROM order_items WHERE order_id = ?`, [result.order_id]);
  assert.equal(supplementItems.length, 0, 'old served items are not duplicated');
  const originalItemsAfter = await db.all(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);
  assert.deepEqual(originalItemsAfter, originalItemsBefore, 'original line items remain byte-for-byte unchanged');
  assert.deepEqual(await db.all(`SELECT * FROM bill_payments WHERE bill_id = ?`, [billId]), paymentsBefore, 'payment remains unchanged');
  assert.deepEqual(await db.all(`SELECT * FROM journal_entries ORDER BY id`), journalBefore, 'journal remains unchanged');

  const correction = await db.get(`SELECT * FROM bill_corrections WHERE bill_id = ? AND type = 'reopen'`, [billId]);
  assert.equal(Number(correction.amount), 0, 'reopen itself creates no financial difference');
  assert.equal(Number(correction.related_order_id), Number(result.order_id));
  const tableAfter = await db.get(`SELECT * FROM tables WHERE id = ?`, [table.id]);
  assert.equal(Number(tableAfter.current_order_id), Number(result.order_id));

  await assert.rejects(() => reopenBill(db, { bill_id: billId, reason: 'double click' }), /already active/);
  assert.ok(!(await searchReopenableBills(db, { q: billNo })).some((row) => row.id === billId), 'active supplement hides bill from reopen search');
  await markBillPrinted(db, result.order_id);
  assert.ok((await db.get(`SELECT bill_printed_at FROM orders WHERE id = ?`, [result.order_id])).bill_printed_at);

  db.close();
  console.log('✓ supplemental bill self-check passed');
}

main().catch((error) => {
  console.error('✗ supplemental bill self-check FAILED');
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  for (const file of [tmp, `${tmp}-wal`, `${tmp}-shm`]) {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
  }
});
