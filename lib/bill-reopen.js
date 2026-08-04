/**
 * Reopen a closed (paid) bill so a customer can add more items after billing —
 * the "please bring one more Coke" case.
 *
 * Model = void-and-rebill (chosen with the owner):
 *   - reverse the original sale journal (a contra entry, nothing deleted)
 *   - mark the paid bill 'reopened' (frees the one-paid-per-order slot)
 *   - reactivate the order and re-occupy its table
 *   - keep the existing items AND their stock deduction (food was served)
 *   - log a bill_corrections row (type 'reopen': who / why / when)
 * The cashier then adds items, fires a KOT if needed, and takes a fresh final
 * bill covering everything — one clean invoice per visit.
 *
 * Reuses the accounting engine (reverseJournal) and the same bill_corrections
 * audit table used by void/refund. No accounting math is re-implemented here.
 */

import { ensureColumn } from './db/schema-helpers.js';
import { ensureSqliteTable } from './db/ensure-sqlite-table.js';
import { ensureAccountingSchema } from './accounting.js';
import { reverseJournal } from './accounting-corrections.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const conflict = (m) => Object.assign(new Error(m), { status: 409 });

/** Dev/SQLite safety net — production Postgres gets these from migration 024. */
export async function ensureReopenSchema(db) {
  const ts = db?.driver === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
  // bill_corrections may not exist on a local SQLite dev DB (it ships as a
  // Postgres migration). Create it without a CHECK so 'reopen' is accepted.
  await ensureSqliteTable(
    db,
    `CREATE TABLE IF NOT EXISTS bill_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reason TEXT,
      restocked INTEGER DEFAULT 0,
      journal_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await ensureColumn(db, 'bills', 'reopened_at', ts);
  await ensureColumn(db, 'bills', 'reopen_count', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'orders', 'bill_printed_at', ts);
  await ensureColumn(db, 'orders', 'reopened_from_bill_id', 'INTEGER');
}

async function loadBill(db, { bill_id, bill_number }) {
  let bill = null;
  if (bill_id) bill = await db.get(`SELECT * FROM bills WHERE id = ?`, [bill_id]);
  else if (bill_number) bill = await db.get(`SELECT * FROM bills WHERE bill_number = ?`, [bill_number]);
  if (!bill) throw bad('Bill not found.');
  return bill;
}

/**
 * Reopen a paid bill. Returns the reactivated order so the caller can send the
 * cashier/waiter straight to it to add items and re-bill.
 */
export async function reopenBill(db, { bill_id, bill_number, reason, created_by = null }) {
  if (!String(reason || '').trim()) throw bad('A reason is required to reopen a bill.');
  await ensureReopenSchema(db);
  await ensureAccountingSchema(db);

  const bill = await loadBill(db, { bill_id, bill_number });
  if (String(bill.status) !== 'paid') {
    throw conflict(`Only a paid bill can be reopened — this bill is "${bill.status}".`);
  }
  if (!bill.order_id) throw bad('This bill has no order to reopen.');

  return db.transaction(async (tx) => {
    // Reverse the original sale journal so revenue/tax/payment are undone. A
    // fresh sale is posted when the reopened order is paid again.
    let journalId = null;
    const sale = await tx.get(
      `SELECT id FROM journal_entries WHERE source_type = 'bill' AND source_id = ?`,
      [bill.id]
    );
    if (sale) {
      journalId = await reverseJournal(tx, {
        journal_id: sale.id,
        reason: `Reopen bill ${bill.bill_number}: ${reason}`,
        created_by,
      });
    }

    // Free the paid slot but keep the row for history.
    await tx.run(
      `UPDATE bills
       SET status = 'reopened', reopened_at = CURRENT_TIMESTAMP, reopen_count = COALESCE(reopen_count, 0) + 1
       WHERE id = ?`,
      [bill.id]
    );

    // Reactivate the order. Do NOT restock — the food was served and consumed;
    // the existing items stay on the order and roll into the new final bill.
    await tx.run(
      `UPDATE orders
       SET status = 'preparing',
           bill_printed_at = NULL,
           reopened_from_bill_id = ?,
           notes = COALESCE(notes, '') || ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [bill.id, `\nReopened bill ${bill.bill_number}: ${reason}`, bill.order_id]
    );

    const order = await tx.get(
      `SELECT id, order_number, table_id, table_number FROM orders WHERE id = ?`,
      [bill.order_id]
    );

    // Re-occupy the table if this was a dine-in order and the table is free.
    if (order?.table_id) {
      await tx.run(
        `UPDATE tables
         SET status = 'occupied', current_order_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND (current_order_id IS NULL OR current_order_id = ?)`,
        [order.id, order.table_id, order.id]
      );
    }

    // Audit — same table void/refund use.
    await tx.run(
      `INSERT INTO bill_corrections (bill_id, type, amount, reason, journal_id, created_by)
       VALUES (?, 'reopen', ?, ?, ?, ?)`,
      [bill.id, round2(bill.grand_total), reason, journalId, created_by]
    );

    return {
      bill_id: bill.id,
      bill_number: bill.bill_number,
      order_id: order.id,
      order_number: order.order_number,
      table_id: order.table_id || null,
      table_number: order.table_number || null,
      reversed_journal: sale?.id || null,
      journal_id: journalId,
    };
  });
}

/**
 * Search recently paid bills that can still be reopened, for the "find previous
 * bill" box. Matches bill number, order number, table number or customer.
 */
export async function searchReopenableBills(db, { q = '', date = null, limit = 25 } = {}) {
  await ensureReopenSchema(db);
  const term = `%${String(q || '').trim().toLowerCase()}%`;
  const params = [];
  let where = `b.status = 'paid'`;

  if (String(q || '').trim()) {
    where += ` AND (
      lower(b.bill_number) LIKE ?
      OR lower(COALESCE(o.order_number, '')) LIKE ?
      OR lower(COALESCE(t.table_number, o.table_number, '')) LIKE ?
      OR lower(COALESCE(o.customer_name, '')) LIKE ?
      OR COALESCE(o.customer_phone, '') LIKE ?
    )`;
    params.push(term, term, term, term, term);
  }
  if (date) {
    where += ` AND date(b.created_at) = date(?)`;
    params.push(date);
  }

  params.push(Number(limit) || 25);
  return db.all(
    `SELECT b.id, b.bill_number, b.grand_total, b.created_at, b.paid_at,
            o.id AS order_id, o.order_number, o.customer_name, o.customer_phone,
            COALESCE(t.table_number, o.table_number) AS table_number
     FROM bills b
     JOIN orders o ON b.order_id = o.id
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE ${where}
     ORDER BY b.created_at DESC
     LIMIT ?`,
    params
  );
}

/** Stamp that a proforma bill was printed for the customer (no payment taken). */
export async function markBillPrinted(db, orderId) {
  await ensureReopenSchema(db);
  await db.run(
    `UPDATE orders SET bill_printed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
    [orderId]
  );
  return db.get(`SELECT bill_printed_at FROM orders WHERE id = ?`, [orderId]);
}
