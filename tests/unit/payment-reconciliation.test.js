import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PosDatabase } from '../../lib/db/index.js';
import { openBusinessDay } from '../../lib/business-days.js';
import { nepalDateString } from '../../lib/report-dates.js';
import { postJournal, postSaleJournal } from '../../lib/accounting.js';
import { getCorrectionJournalPreview, reverseCorrectionByJournal, voidPaidBill } from '../../lib/bill-corrections.js';
import { outstandingCreditBills, receivableAgeing } from '../../lib/accounting-receivables.js';
import { reverseJournal } from '../../lib/accounting-corrections.js';
import { completeBillPayment, reviseBillSettlement } from '../../lib/bills-admin.js';
import {
  collectCreditBalance,
  ensureSplitPaymentSchema,
  recordInitialSplitSettlement,
  validateAllocations,
  writeOffCreditBalance,
} from '../../lib/split-payments.js';
import { buildPaymentReconciliation } from '../../lib/payment-reconciliation.js';

const dbPath = path.join(os.tmpdir(), `payment-reconciliation-${process.pid}-${Date.now()}.db`);
const db = new PosDatabase(dbPath);
const actor = { id: 1, full_name: 'Admin', role: 'admin' };
const today = nepalDateString();

test.after(() => {
  try { db.close(); } catch { /* already closed */ }
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* already gone */ }
  }
});

let businessDayId;
let customerId;

test('setup an open day and customer', async () => {
  const day = await openBusinessDay(db, { business_date: today, opening_cash: 1000 }, actor);
  businessDayId = day.id;
  await ensureSplitPaymentSchema(db);
  const customer = await db.run(
    `INSERT INTO customers (name,phone,credit_limit,current_credit) VALUES ('Reconciliation Customer','9800000001',5000,0)`
  );
  customerId = customer.lastInsertRowid;
  assert.ok(businessDayId);
  assert.ok(customerId);
});

async function makeCreditBill({ number, total }) {
  const order = await db.run(
    `INSERT INTO orders (order_number,status,customer_id,customer_name,business_day_id)
     VALUES (?, 'completed', ?, 'Reconciliation Customer', ?)`,
    [`ORDER-${number}`, customerId, businessDayId]
  );
  const bill = await db.run(
    `INSERT INTO bills
       (bill_number,order_id,subtotal,grand_total,status,customer_id,outstanding_amount,payment_status,business_day_id,created_at)
     VALUES (?,?,?,?, 'unpaid', ?,0,'unpaid',?,CURRENT_TIMESTAMP)`,
    [number, order.lastInsertRowid, total, total, customerId, businessDayId]
  );
  const customer = await db.get('SELECT * FROM customers WHERE id=?', [customerId]);
  const allocations = validateAllocations([{ method: 'credit', amount: total }], total, {
    customer, allowCredit: true, actorRole: 'admin',
  });
  await recordInitialSplitSettlement(db, {
    billId: bill.lastInsertRowid,
    billNumber: number,
    total,
    allocations,
    customer,
    actorId: actor.id,
    requestKey: `initial-${number}`,
    businessDayId,
  });
  return bill.lastInsertRowid;
}

test('credit collection and several write-offs reconcile without double-counting', async () => {
  const billId = await makeCreditBill({ number: 'RECON-CREDIT', total: 100 });
  await collectCreditBalance(db, {
    billId,
    allocations: [{ method: 'cash', amount: 40, cash_tendered: 40 }],
    actorId: actor.id,
    actorRole: 'admin',
    requestKey: 'collect-recon-credit',
  });
  await writeOffCreditBalance(db, {
    billId, amount: 30, reason: 'First adjustment', actorId: actor.id,
    actorRole: 'admin', allowCreditWriteOff: true, requestKey: 'writeoff-recon-1',
  });
  await writeOffCreditBalance(db, {
    billId, amount: 30, reason: 'Second adjustment', actorId: actor.id,
    actorRole: 'admin', allowCreditWriteOff: true, requestKey: 'writeoff-recon-2',
  });

  const journals = await db.all(`SELECT id FROM journal_entries WHERE source_type='credit_writeoff' ORDER BY id`);
  assert.equal(journals.length, 2, 'partial write-offs keep separate journals');

  const report = await buildPaymentReconciliation(db, { start: today, end: today }, businessDayId);
  const row = report.bills.find((entry) => entry.billId === billId);
  assert.equal(row.result, 'balanced');
  assert.equal(row.received, 40);
  assert.equal(row.writtenOff, 60);
  assert.equal(row.outstanding, 0);
  assert.equal(report.credit.sold, 100);
  assert.equal(report.credit.collected, 40);
  assert.equal(report.credit.writtenOff, 60);
  assert.equal(report.credit.difference, 0);
});

test('void reverses sale, collections, write-offs and settlement rows together', async () => {
  const bill = await db.get(`SELECT id FROM bills WHERE bill_number='RECON-CREDIT'`);
  const result = await voidPaidBill(db, {
    bill_id: bill.id, reason: 'Test complete reversal', restock: false, created_by: actor.id,
  });

  assert.deepEqual(result.refund_by_method, [{ method: 'cash', amount: 40 }]);
  assert.ok(result.reversed_journals.length >= 4, 'sale, collection and both write-offs are reversed');

  const updated = await db.get(`SELECT status,payment_status,outstanding_amount FROM bills WHERE id=?`, [bill.id]);
  assert.equal(updated.status, 'voided');
  assert.equal(updated.payment_status, 'voided');
  assert.equal(Number(updated.outstanding_amount), 0);

  const activePayments = await db.get(
    `SELECT COUNT(*) AS count FROM bill_payments
     WHERE bill_id=? AND LOWER(COALESCE(settlement_status,'received')) NOT IN ('voided','cancelled','failed')`,
    [bill.id]
  );
  const activeAllocations = await db.get(
    `SELECT COUNT(*) AS count FROM bill_payment_allocations
     WHERE bill_id=? AND LOWER(COALESCE(settlement_status,'received')) NOT IN ('voided','cancelled','failed')`,
    [bill.id]
  );
  assert.equal(Number(activePayments.count), 0);
  assert.equal(Number(activeAllocations.count), 0);

  const customerLedger = await db.get(
    `SELECT COALESCE(SUM(debit-credit),0) AS balance FROM customer_ledger WHERE bill_id=?`,
    [bill.id]
  );
  const customer = await db.get(`SELECT current_credit FROM customers WHERE id=?`, [customerId]);
  assert.equal(Number(customerLedger.balance), 0);
  assert.equal(Number(customer.current_credit), 0);

  const report = await buildPaymentReconciliation(db, { start: today, end: today }, businessDayId);
  const row = report.bills.find((entry) => entry.billId === bill.id);
  assert.equal(row.result, 'voided_clear');
});

test('credit collection and write-off reject a voided bill', async () => {
  const bill = await db.get(`SELECT id FROM bills WHERE bill_number='RECON-CREDIT'`);
  await db.run(`UPDATE bills SET outstanding_amount=10 WHERE id=?`, [bill.id]);
  await assert.rejects(
    collectCreditBalance(db, { billId: bill.id, allocations: [{ method: 'cash', amount: 10 }], actorId: actor.id, actorRole: 'admin', requestKey: 'void-collect' }),
    /voided bill cannot take/i
  );
  await assert.rejects(
    writeOffCreditBalance(db, { billId: bill.id, amount: 10, actorId: actor.id, actorRole: 'admin', allowCreditWriteOff: true, requestKey: 'void-writeoff' }),
    /voided bill cannot have customer credit written off/i
  );
});

test('reversing a bill journal performs a full void and removes its credit', async () => {
  const before = Number((await db.get(`SELECT current_credit FROM customers WHERE id=?`, [customerId])).current_credit || 0);
  const billId = await makeCreditBill({ number: 'RECON-JOURNAL-CREDIT', total: 70 });
  const journal = await db.get(`SELECT id FROM journal_entries WHERE source_type='bill' AND source_id=?`, [billId]);
  assert.ok(journal?.id);

  // Reproduce the old half-correction: accounting was reversed, but the bill
  // and customer ledger were left active.
  await db.transaction((tx) => reverseJournal(tx, {
    journal_id: journal.id,
    reason: 'Legacy ledger-only reversal',
    created_by: actor.id,
  }));

  const preview = await getCorrectionJournalPreview(db, journal.id);
  assert.equal(preview.action, 'void_bill');
  assert.equal(preview.bill.id, billId);
  assert.equal(Number(preview.bill.credit.outstanding), 70);
  assert.ok(preview.journal.reversal_id);

  const result = await reverseCorrectionByJournal(db, {
    journal_id: journal.id,
    reason: 'Wrong customer credit bill',
    restock: false,
    created_by: actor.id,
  });
  assert.equal(result.action, 'void_bill');

  const bill = await db.get(`SELECT status,payment_status,outstanding_amount FROM bills WHERE id=?`, [billId]);
  assert.equal(bill.status, 'voided');
  assert.equal(bill.payment_status, 'voided');
  assert.equal(Number(bill.outstanding_amount), 0);
  const after = Number((await db.get(`SELECT current_credit FROM customers WHERE id=?`, [customerId])).current_credit || 0);
  assert.equal(after, before);
  assert.equal((await outstandingCreditBills(db, customerId)).some((row) => row.id === billId), false);
  const ageing = await receivableAgeing(db);
  assert.equal(ageing.some((row) => row.customer_id === customerId && Number(row.total) > after + 0.001), false);
});

test('reversing an unrelated journal remains ledger-only', async () => {
  const journalId = await postJournal(db, {
    memo: 'Standalone correction test',
    source_type: 'manual_adjustment',
    source_id: 987654,
    business_day_id: businessDayId,
    lines: [
      { code: '1010', debit: 5, credit: 0, memo: 'test debit' },
      { code: '3010', debit: 0, credit: 5, memo: 'test credit' },
    ],
  });
  const preview = await getCorrectionJournalPreview(db, journalId);
  assert.equal(preview.action, 'reverse_journal');
  assert.equal(preview.bill, null);

  const before = Number((await db.get(`SELECT COUNT(*) AS count FROM bill_corrections`)).count);
  const result = await reverseCorrectionByJournal(db, {
    journal_id: journalId,
    reason: 'Standalone test reversal',
    created_by: actor.id,
  });
  assert.equal(result.action, 'reverse_journal');
  assert.ok(result.journal_id);
  const after = Number((await db.get(`SELECT COUNT(*) AS count FROM bill_corrections`)).count);
  assert.equal(after, before);
});

test('settlement revision can create clean credit, then locks after credit activity', async () => {
  const order = await db.run(
    `INSERT INTO orders (order_number,status,customer_id,business_day_id) VALUES ('ORDER-REVISE','completed',?,?)`,
    [customerId, businessDayId]
  );
  const bill = await db.run(
    `INSERT INTO bills
       (bill_number,order_id,subtotal,grand_total,status,customer_id,outstanding_amount,payment_status,business_day_id)
     VALUES ('RECON-REVISE',?,100,100,'paid',?,0,'paid',?)`,
    [order.lastInsertRowid, customerId, businessDayId]
  );
  const customer = await db.get(`SELECT * FROM customers WHERE id=?`, [customerId]);
  const initial = validateAllocations([{ method: 'cash', amount: 100, cash_tendered: 100 }], 100, { customer, allowCredit: true, actorRole: 'admin' });
  await recordInitialSplitSettlement(db, {
    billId: bill.lastInsertRowid, billNumber: 'RECON-REVISE', total: 100,
    allocations: initial, customer, actorId: actor.id, requestKey: 'initial-revise', businessDayId,
  });

  await reviseBillSettlement(db, {
    billId: bill.lastInsertRowid,
    reason: 'Customer requested account credit',
    allocations: [{ method: 'credit', amount: 100 }],
    customerId,
    actorId: actor.id,
    actorRole: 'admin',
  });
  const revised = await db.get(`SELECT status,payment_status,outstanding_amount FROM bills WHERE id=?`, [bill.lastInsertRowid]);
  assert.equal(revised.status, 'partially_paid');
  assert.equal(revised.payment_status, 'partially_paid');
  assert.equal(Number(revised.outstanding_amount), 100);

  const report = await buildPaymentReconciliation(db, { start: today, end: today }, businessDayId);
  const row = report.bills.find((entry) => entry.billId === bill.lastInsertRowid);
  assert.equal(row.result, 'balanced');
  assert.equal(row.soldOnCredit, 100);
  assert.equal(row.outstanding, 100);

  await collectCreditBalance(db, {
    billId: bill.lastInsertRowid,
    allocations: [{ method: 'cash', amount: 25, cash_tendered: 25 }],
    actorId: actor.id, actorRole: 'admin', requestKey: 'collect-after-revise',
  });
  await assert.rejects(
    reviseBillSettlement(db, {
      billId: bill.lastInsertRowid, reason: 'Unsafe replacement',
      allocations: [{ method: 'cash', amount: 100, cash_tendered: 100 }],
      customerId, actorId: actor.id, actorRole: 'admin',
    }),
    /cannot be replaced after credit has been collected/i
  );
});

test('ordinary partial payments are idempotent and cannot exceed the remaining balance', async () => {
  const order = await db.run(`INSERT INTO orders (order_number,status,business_day_id) VALUES ('ORDER-PARTIAL','completed',?)`, [businessDayId]);
  const bill = await db.run(
    `INSERT INTO bills
       (bill_number,order_id,subtotal,grand_total,status,outstanding_amount,payment_status,business_day_id)
     VALUES ('RECON-PARTIAL',?,100,100,'unpaid',100,'unpaid',?)`,
    [order.lastInsertRowid, businessDayId]
  );
  const first = await completeBillPayment(db, {
    billId: bill.lastInsertRowid, amount: 60, method: 'split',
    allocations: [
      { method: 'cash', amount: 30, cash_tendered: 30 },
      { method: 'qr', amount: 30, provider: 'Fonepay', verified: true },
    ],
    requestKey: 'partial-payment-1', actorId: actor.id,
  });
  assert.equal(first.collected, 60);
  assert.equal(first.remainingBalance, 40);

  const duplicate = await completeBillPayment(db, {
    billId: bill.lastInsertRowid, amount: 60, method: 'split',
    allocations: [
      { method: 'cash', amount: 30, cash_tendered: 30 },
      { method: 'qr', amount: 30, provider: 'Fonepay', verified: true },
    ],
    requestKey: 'partial-payment-1', actorId: actor.id,
  });
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.collected, 0);

  await assert.rejects(
    completeBillPayment(db, {
      billId: bill.lastInsertRowid, amount: 50, method: 'cash', requestKey: 'partial-payment-too-large', actorId: actor.id,
    }),
    /Only 40 is outstanding/
  );
  const final = await completeBillPayment(db, {
    billId: bill.lastInsertRowid, amount: 40, method: 'cash', requestKey: 'partial-payment-2', actorId: actor.id,
  });
  assert.equal(final.remainingBalance, 0);

  const payments = await db.get(`SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount FROM bill_payments WHERE bill_id=?`, [bill.lastInsertRowid]);
  const journals = await db.get(`SELECT COUNT(*) AS count FROM journal_entries WHERE source_type='bill_payment' AND source_id IN (SELECT id FROM bill_payments WHERE bill_id=?)`, [bill.lastInsertRowid]);
  assert.equal(Number(payments.count), 3);
  assert.equal(Number(payments.amount), 100);
  assert.equal(Number(journals.count), 2);
});

test('reconciliation identifies excess and active voided payments bill by bill', async () => {
  const orderA = await db.run(`INSERT INTO orders (order_number,status,business_day_id) VALUES ('ORDER-EXCESS','completed',?)`, [businessDayId]);
  const billA = await db.run(
    `INSERT INTO bills (bill_number,order_id,subtotal,grand_total,status,outstanding_amount,payment_status,business_day_id)
     VALUES ('RECON-EXCESS',?,100,100,'paid',0,'paid',?)`,
    [orderA.lastInsertRowid, businessDayId]
  );
  await db.run(`INSERT INTO bill_payments (bill_id,amount,payment_method,settlement_status,business_day_id) VALUES (?,130,'cash','received',?)`, [billA.lastInsertRowid, businessDayId]);
  await postSaleJournal(db, { bill_id: billA.lastInsertRowid, bill_number: 'RECON-EXCESS', parts: [{ method: 'cash', amount: 100 }], business_day_id: businessDayId });

  const orderB = await db.run(`INSERT INTO orders (order_number,status,business_day_id) VALUES ('ORDER-VOID-ACTIVE','cancelled',?)`, [businessDayId]);
  const billB = await db.run(
    `INSERT INTO bills (bill_number,order_id,subtotal,grand_total,status,outstanding_amount,payment_status,business_day_id)
     VALUES ('RECON-VOID-ACTIVE',?,50,50,'voided',0,'voided',?)`,
    [orderB.lastInsertRowid, businessDayId]
  );
  await db.run(`INSERT INTO bill_payments (bill_id,amount,payment_method,settlement_status,business_day_id) VALUES (?,50,'cash','received',?)`, [billB.lastInsertRowid, businessDayId]);

  const report = await buildPaymentReconciliation(db, { start: today, end: today }, businessDayId);
  assert.equal(report.bills.find((row) => row.billId === billA.lastInsertRowid).result, 'excess');
  assert.equal(report.bills.find((row) => row.billId === billB.lastInsertRowid).result, 'voided_payment');
  assert.equal(report.totals.excessPayments, 30);
  assert.equal(report.totals.voidedPayments, 50);
  assert.equal(report.totals.needsAttention, 80);
});
