/**
 * Create an audited supplemental order for a paid bill.
 *
 * The original invoice, payment, journal, served items, and stock movements
 * stay immutable. The new order starts empty and is billed only for new items.
 */

import { ensureColumn } from './db/schema-helpers.js';
import { ensureSqliteTable } from './db/ensure-sqlite-table.js';
import { writeAudit } from './audit.js';

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const conflict = (message) => Object.assign(new Error(message), { status: 409 });

export async function ensureReopenSchema(db) {
  const ts = db?.driver === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS bill_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reason TEXT,
    restocked INTEGER DEFAULT 0,
    journal_id INTEGER,
    created_by INTEGER,
    related_order_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await ensureColumn(db, 'bills', 'reopened_at', ts);
  await ensureColumn(db, 'bills', 'reopen_count', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'bills', 'parent_bill_id', 'INTEGER');
  await ensureColumn(db, 'orders', 'bill_printed_at', ts);
  await ensureColumn(db, 'orders', 'reopened_from_bill_id', 'INTEGER');
  await ensureColumn(db, 'bill_corrections', 'related_order_id', 'INTEGER');
}

export async function reopenBill(db, { bill_id, bill_number, reason, created_by = null }) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw bad('A reason is required to reopen a bill.');
  if (!bill_id && !bill_number) throw bad('Bill id or bill number is required.');
  await ensureReopenSchema(db);

  return db.transaction(async (tx) => {
    const selector = bill_id ? 'b.id = ?' : 'b.bill_number = ?';
    const value = bill_id || bill_number;
    const lock = tx.driver === 'postgres' ? ' FOR UPDATE' : '';
    const bill = await tx.get(
      `SELECT b.*, o.order_number, o.table_id, o.table_number, o.order_type,
              o.waiter_id, o.customer_id, o.customer_name, o.customer_phone
       FROM bills b JOIN orders o ON o.id = b.order_id
       WHERE ${selector}${lock}`,
      [value]
    );
    if (!bill) throw bad('Bill not found.');
    if (String(bill.status) !== 'paid') {
      throw conflict(`Only a paid bill can be reopened. This bill is "${bill.status}".`);
    }

    const active = await tx.get(
      `SELECT id, order_number FROM orders
       WHERE reopened_from_bill_id = ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY id DESC LIMIT 1`,
      [bill.id]
    );
    if (active) {
      throw conflict(`A supplemental order (${active.order_number}) is already active for this bill.`);
    }

    if (bill.table_id) {
      const table = await tx.get(`SELECT current_order_id FROM tables WHERE id = ?${lock}`, [bill.table_id]);
      if (table?.current_order_id && Number(table.current_order_id) !== Number(bill.order_id)) {
        throw conflict('The original table is occupied by another order. Move or finish that order first.');
      }
    }

    const orderNumber = `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const created = await tx.run(
      `INSERT INTO orders (
         order_number, table_id, table_number, order_type, status, waiter_id,
         customer_id, customer_name, customer_phone, notes, reopened_from_bill_id,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'preparing', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [orderNumber, bill.table_id || null, bill.table_number || null, bill.order_type || 'takeaway',
        bill.waiter_id || null, bill.customer_id || null, bill.customer_name || null,
        bill.customer_phone || null, `Supplement to ${bill.bill_number}: ${cleanReason}`, bill.id]
    );
    const orderId = created.lastInsertRowid;

    await tx.run(
      `UPDATE bills SET reopened_at = CURRENT_TIMESTAMP,
       reopen_count = COALESCE(reopen_count, 0) + 1 WHERE id = ?`,
      [bill.id]
    );

    if (bill.table_id) {
      await tx.run(
        `UPDATE tables SET status = 'occupied', current_order_id = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [orderId, bill.table_id]
      );
    }

    await tx.run(
      `INSERT INTO bill_corrections (bill_id, type, amount, reason, created_by, related_order_id)
       VALUES (?, 'reopen', 0, ?, ?, ?)`,
      [bill.id, cleanReason, created_by, orderId]
    );
    await writeAudit(tx, {
      event_type: 'bill.supplement_opened',
      entity_type: 'bill',
      entity_id: bill.id,
      actor: { id: created_by },
      reason: cleanReason,
      after: { supplemental_order_id: orderId, supplemental_order_number: orderNumber },
    });

    return {
      bill_id: bill.id,
      bill_number: bill.bill_number,
      original_order_id: bill.order_id,
      order_id: orderId,
      order_number: orderNumber,
      table_id: bill.table_id || null,
      table_number: bill.table_number || null,
      supplemental: true,
    };
  });
}

export async function searchReopenableBills(db, { q = '', date = null, limit = 25 } = {}) {
  await ensureReopenSchema(db);
  const term = `%${String(q || '').trim().toLowerCase()}%`;
  const params = [];
  let where = `b.status = 'paid' AND NOT EXISTS (
    SELECT 1 FROM orders active
    WHERE active.reopened_from_bill_id = b.id
      AND active.status NOT IN ('completed', 'cancelled')
  )`;

  if (String(q || '').trim()) {
    where += ` AND (
      lower(b.bill_number) LIKE ? OR lower(COALESCE(o.order_number, '')) LIKE ?
      OR lower(COALESCE(t.table_number, o.table_number, '')) LIKE ?
      OR lower(COALESCE(o.customer_name, '')) LIKE ? OR COALESCE(o.customer_phone, '') LIKE ?
    )`;
    params.push(term, term, term, term, term);
  }
  if (date) {
    where += ` AND date(b.created_at) = date(?)`;
    params.push(date);
  }
  params.push(Math.min(Math.max(Number(limit) || 25, 1), 100));

  return db.all(
    `SELECT b.id, b.bill_number, b.grand_total, b.created_at, b.paid_at,
            b.reopen_count, o.id AS order_id, o.order_number, o.customer_name,
            o.customer_phone, COALESCE(t.table_number, o.table_number) AS table_number
     FROM bills b JOIN orders o ON b.order_id = o.id
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE ${where} ORDER BY b.created_at DESC LIMIT ?`,
    params
  );
}

export async function markBillPrinted(db, orderId) {
  await ensureReopenSchema(db);
  await db.run(
    `UPDATE orders SET bill_printed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
    [orderId]
  );
  return db.get(`SELECT bill_printed_at FROM orders WHERE id = ?`, [orderId]);
}
