/**
 * Self-check for the reopen-bill engine (lib/bill-reopen.js).
 * Builds a throwaway SQLite DB (full dev schema auto-seeds), creates a paid
 * dine-in order + sale journal, reopens it, and asserts the whole state
 * machine + that the general ledger stays balanced after the reversal.
 *
 *   node scripts/check-bill-reopen.mjs
 */
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
  const items = await db.all(`SELECT id, name, base_price FROM menu_items ORDER BY id LIMIT 2`);
  assert.ok(table && items.length >= 2, 'seed data should provide a table + menu items');

  // --- a completed, paid dine-in order -------------------------------------
  const orderNo = `ORD-TEST-${Date.now()}`;
  const ins = await db.run(
    `INSERT INTO orders (order_number, table_id, table_number, order_type, status, created_at, updated_at)
     VALUES (?, ?, ?, 'dine_in', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [orderNo, table.id, table.table_number]
  );
  const orderId = ins.lastInsertRowid;

  let subtotal = 0;
  for (const it of items) {
    const qty = 2;
    const price = Number(it.base_price) || 100;
    const line = price * qty;
    subtotal += line;
    await db.run(
      `INSERT INTO order_items (order_id, item_id, menu_item_id, item_name, quantity, price, subtotal, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'served')`,
      [orderId, it.id, it.id, it.name, qty, price, line]
    );
  }
  const grandTotal = subtotal; // no tax/service in the fixture

  const billNo = `BILL-TEST-${Date.now()}`;
  const billIns = await db.run(
    `INSERT INTO bills (bill_number, order_id, subtotal, tax, service_charge, grand_total, status, created_at, paid_at)
     VALUES (?, ?, ?, 0, 0, ?, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [billNo, orderId, subtotal, grandTotal]
  );
  const billId = billIns.lastInsertRowid;
  await db.run(
    `INSERT INTO bill_payments (bill_id, amount, payment_method) VALUES (?, ?, 'cash')`,
    [billId, grandTotal]
  );
  await postSaleJournal(db, { bill_id: billId, bill_number: billNo, parts: [{ method: 'cash', amount: grandTotal }] });

  // Post-payment table state: freed.
  await db.run(`UPDATE tables SET status = 'available', current_order_id = NULL WHERE id = ?`, [table.id]);

  const glBefore = await db.get(`SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM journal_lines`);
  assert.ok(Math.abs(glBefore.d - glBefore.c) < 0.001, 'ledger balanced before reopen');
  assert.ok(glBefore.d > 0, 'a sale journal was posted');

  // --- reopen ---------------------------------------------------------------
  const res = await reopenBill(db, { bill_id: billId, reason: 'Customer wants one more Coke', created_by: null });
  assert.equal(res.order_id, orderId, 'reopen returns the order');
  assert.ok(res.journal_id, 'a reversal journal was created');

  const bill = await db.get(`SELECT * FROM bills WHERE id = ?`, [billId]);
  assert.equal(bill.status, 'reopened', 'bill marked reopened');
  assert.equal(Number(bill.reopen_count), 1, 'reopen_count incremented');
  assert.ok(bill.reopened_at, 'reopened_at stamped');

  const order = await db.get(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  assert.equal(order.status, 'preparing', 'order reactivated');
  assert.equal(order.reopened_from_bill_id, billId, 'order links back to the reopened bill');
  assert.equal(order.bill_printed_at, null, 'proforma stamp cleared on reopen');

  const tbl = await db.get(`SELECT * FROM tables WHERE id = ?`, [table.id]);
  assert.equal(tbl.status, 'occupied', 'table re-occupied');
  assert.equal(Number(tbl.current_order_id), Number(orderId), 'table points back at the order');

  const corr = await db.get(`SELECT * FROM bill_corrections WHERE bill_id = ? AND type = 'reopen'`, [billId]);
  assert.ok(corr, 'audit row written');
  assert.equal(round2(corr.amount), round2(grandTotal), 'audit amount = bill total');
  assert.match(corr.reason, /Coke/, 'audit keeps the reason');

  // items and their stock deduction are untouched (food was served)
  const liveItems = await db.all(
    `SELECT COUNT(*) n FROM order_items WHERE order_id = ? AND COALESCE(status,'') NOT IN ('voided','cancelled')`,
    [orderId]
  );
  assert.equal(Number(liveItems[0].n), items.length, 'existing items preserved');

  const glAfter = await db.get(`SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM journal_lines`);
  assert.ok(Math.abs(glAfter.d - glAfter.c) < 0.001, 'ledger still balanced after reversal');

  // --- guard: cannot reopen a bill that is no longer paid -------------------
  await assert.rejects(
    () => reopenBill(db, { bill_id: billId, reason: 'again' }),
    /Only a paid bill/,
    'reopening a reopened bill is blocked'
  );

  // --- guard: reason required ----------------------------------------------
  await assert.rejects(() => reopenBill(db, { bill_id: billId, reason: '  ' }), /reason is required/);

  // --- search finds the (now reopened) order's original is gone from paid ---
  const found = await searchReopenableBills(db, { q: table.table_number });
  assert.ok(Array.isArray(found), 'search returns a list');
  assert.ok(!found.some((b) => b.id === billId), 'reopened bill no longer appears as reopenable');

  // --- proforma: mark printed without changing status -----------------------
  await markBillPrinted(db, orderId);
  const afterPrint = await db.get(`SELECT status, bill_printed_at FROM orders WHERE id = ?`, [orderId]);
  assert.ok(afterPrint.bill_printed_at, 'bill_printed_at stamped');
  assert.equal(afterPrint.status, 'preparing', 'printing a proforma does not complete the order');

  db.close();
  console.log('✓ bill-reopen self-check passed');
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

main()
  .catch((e) => {
    console.error('✗ bill-reopen self-check FAILED');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });
