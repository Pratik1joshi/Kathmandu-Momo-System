/**
 * Floor operations on open (pre-payment) dine-in orders:
 *
 *   transferOrder — move one order to a different table (customer changed seats,
 *                   or a table needs freeing). Old table released, new table
 *                   occupied, the order and its KOTs follow.
 *   mergeTables   — combine two occupied tables into one bill. All active items
 *                   and KOTs move onto the survivor order; the source order is
 *                   cancelled (kept for history, points at the survivor) and its
 *                   table is freed. No restock — the food is still the food.
 *
 * Both refuse to touch a paid/completed order (that is the reopen flow's job)
 * and log every move to table_ops_log with who / why / when.
 */

import { ensureColumn } from './db/schema-helpers.js';
import { ensureSqliteTable } from './db/ensure-sqlite-table.js';

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const conflict = (m) => Object.assign(new Error(m), { status: 409 });

const TERMINAL = new Set(['completed', 'cancelled']);

export async function ensureTableOpsSchema(db) {
  await ensureSqliteTable(
    db,
    `CREATE TABLE IF NOT EXISTS table_ops_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      order_id INTEGER,
      merged_order_id INTEGER,
      from_table_id INTEGER,
      to_table_id INTEGER,
      reason TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await ensureColumn(db, 'orders', 'merged_into_order_id', 'INTEGER');
}

async function loadOpenOrder(db, orderId) {
  const order = await db.get(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  if (!order) throw bad('Order not found.');
  if (TERMINAL.has(String(order.status))) {
    throw conflict('That order is already closed — reopen it instead of moving it.');
  }
  // A paid bill means the order is effectively closed even if status lagged.
  const paid = await db.get(`SELECT id FROM bills WHERE order_id = ? AND status = 'paid'`, [orderId]);
  if (paid) throw conflict('That order is already billed — reopen it instead.');
  return order;
}

async function currentOrderIdForTable(db, tableId) {
  const t = await db.get(`SELECT current_order_id FROM tables WHERE id = ?`, [tableId]);
  return t?.current_order_id || null;
}

/**
 * Move an order to another table. `toTableId` must be free (or already this
 * order's table). Returns the updated order id + table numbers.
 */
export async function transferOrder(db, { order_id, from_table_id, to_table_id, reason = '', created_by = null }) {
  await ensureTableOpsSchema(db);
  const resolvedOrderId = order_id || (from_table_id ? await currentOrderIdForTable(db, from_table_id) : null);
  if (!resolvedOrderId) throw bad('That table has no open order to move.');
  if (!to_table_id) throw bad('Pick a destination table.');
  order_id = resolvedOrderId;

  const order = await loadOpenOrder(db, order_id);
  const toTable = await db.get(`SELECT * FROM tables WHERE id = ?`, [to_table_id]);
  if (!toTable) throw bad('Destination table not found.');

  if (Number(order.table_id) === Number(to_table_id)) {
    throw bad('That order is already on this table.');
  }
  const occupant = await currentOrderIdForTable(db, to_table_id);
  if (occupant && Number(occupant) !== Number(order_id)) {
    throw conflict(`Table ${toTable.table_number} already has an open order — merge instead of transferring.`);
  }

  const fromTableId = order.table_id || null;

  return db.transaction(async (tx) => {
    await tx.run(
      `UPDATE orders SET table_id = ?, table_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [to_table_id, toTable.table_number, order_id]
    );
    if (fromTableId) {
      await tx.run(
        `UPDATE tables SET status = 'available', current_order_id = NULL, waiter_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND current_order_id = ?`,
        [fromTableId, order_id]
      );
    }
    await tx.run(
      `UPDATE tables SET status = 'occupied', current_order_id = ?, waiter_id = COALESCE(waiter_id, ?), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [order_id, order.waiter_id || null, to_table_id]
    );
    await tx.run(
      `INSERT INTO table_ops_log (action, order_id, from_table_id, to_table_id, reason, created_by)
       VALUES ('transfer', ?, ?, ?, ?, ?)`,
      [order_id, fromTableId, to_table_id, reason || null, created_by]
    );
    return {
      order_id,
      from_table_id: fromTableId,
      to_table_id,
      to_table_number: toTable.table_number,
    };
  });
}

/**
 * Merge the source order into the target order (both open). Items + KOTs move to
 * the target; the source order is cancelled and its table freed. One bill.
 * Accepts order ids directly, or table ids (resolved to their current order).
 */
export async function mergeTables(db, {
  source_order_id, target_order_id, source_table_id, target_table_id, reason = '', created_by = null,
}) {
  await ensureTableOpsSchema(db);

  const srcOrderId = source_order_id || (source_table_id ? await currentOrderIdForTable(db, source_table_id) : null);
  const tgtOrderId = target_order_id || (target_table_id ? await currentOrderIdForTable(db, target_table_id) : null);
  if (!srcOrderId) throw bad('The table being merged has no open order.');
  if (!tgtOrderId) throw bad('The destination table has no open order.');
  if (Number(srcOrderId) === Number(tgtOrderId)) throw bad('Cannot merge an order into itself.');

  const source = await loadOpenOrder(db, srcOrderId);
  const target = await loadOpenOrder(db, tgtOrderId);

  return db.transaction(async (tx) => {
    // Move active line items onto the survivor.
    await tx.run(
      `UPDATE order_items SET order_id = ?
       WHERE order_id = ? AND COALESCE(status, '') NOT IN ('voided', 'cancelled')`,
      [tgtOrderId, srcOrderId]
    );
    // KOTs follow so the kitchen keeps one ticket stream per surviving order.
    try {
      await tx.run(`UPDATE kots SET order_id = ? WHERE order_id = ?`, [tgtOrderId, srcOrderId]);
    } catch {
      /* kots table may be absent in a minimal DB */
    }

    // Retire the source order (kept for history) and free its table.
    await tx.run(
      `UPDATE orders
       SET status = 'cancelled', merged_into_order_id = ?,
           notes = COALESCE(notes, '') || ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [tgtOrderId, `\nMerged into order ${target.order_number}: ${reason || 'table merge'}`, srcOrderId]
    );
    if (source.table_id) {
      await tx.run(
        `UPDATE tables SET status = 'available', current_order_id = NULL, waiter_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND current_order_id = ?`,
        [source.table_id, srcOrderId]
      );
    }
    // Keep the survivor's table occupied and note the merge on the order.
    if (target.table_id) {
      await tx.run(
        `UPDATE tables SET status = 'occupied', current_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [tgtOrderId, target.table_id]
      );
    }
    await tx.run(
      `UPDATE orders SET notes = COALESCE(notes, '') || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [`\nMerged in order ${source.order_number}`, tgtOrderId]
    );

    await tx.run(
      `INSERT INTO table_ops_log (action, order_id, merged_order_id, from_table_id, to_table_id, reason, created_by)
       VALUES ('merge', ?, ?, ?, ?, ?, ?)`,
      [tgtOrderId, srcOrderId, source.table_id || null, target.table_id || null, reason || null, created_by]
    );

    const items = await tx.all(
      `SELECT COUNT(*) n FROM order_items WHERE order_id = ? AND COALESCE(status,'') NOT IN ('voided','cancelled')`,
      [tgtOrderId]
    );
    return {
      target_order_id: tgtOrderId,
      target_order_number: target.order_number,
      source_order_id: srcOrderId,
      freed_table_id: source.table_id || null,
      merged_item_count: Number(items[0]?.n || 0),
    };
  });
}

/** Recent transfer/merge history for an audit view. */
export async function listTableOps(db, limit = 50) {
  await ensureTableOpsSchema(db);
  return db.all(
    `SELECT tl.*, u.full_name AS by_name,
            ft.table_number AS from_table_number, tt.table_number AS to_table_number
     FROM table_ops_log tl
     LEFT JOIN users u ON tl.created_by = u.id
     LEFT JOIN tables ft ON tl.from_table_id = ft.id
     LEFT JOIN tables tt ON tl.to_table_id = tt.id
     ORDER BY tl.id DESC LIMIT ${Number(limit) || 50}`
  );
}
