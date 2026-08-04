/**
 * Self-check for the table-ops engine (lib/table-ops.js): transfer + merge.
 * Builds a throwaway SQLite DB, seats two orders on two tables (with items and
 * KOTs), then merges and transfers, asserting the floor + kitchen state.
 *
 *   node scripts/check-table-ops.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PosDatabase } from '../lib/db/index.js';
import { transferOrder, mergeTables, listTableOps } from '../lib/table-ops.js';

const tmp = path.join(os.tmpdir(), `tableops-check-${Date.now()}.db`);

async function seatOrder(db, table, items, qtyEach = 1) {
  const no = `ORD-${table.id}-${Math.random().toString(36).slice(2, 7)}`;
  const ins = await db.run(
    `INSERT INTO orders (order_number, table_id, table_number, order_type, status, created_at, updated_at)
     VALUES (?, ?, ?, 'dine_in', 'preparing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [no, table.id, table.table_number]
  );
  const orderId = ins.lastInsertRowid;
  for (const it of items) {
    await db.run(
      `INSERT INTO order_items (order_id, item_id, menu_item_id, item_name, quantity, price, subtotal, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orderId, it.id, it.id, it.name, qtyEach, it.base_price || 100, (it.base_price || 100) * qtyEach]
    );
  }
  // one KOT
  const kot = await db.run(`INSERT INTO kots (order_id, station, status) VALUES (?, 'hot-kitchen', 'pending')`, [orderId]);
  await db.run(`INSERT INTO kot_items (kot_id, menu_item_id, quantity, status) VALUES (?, ?, 1, 'pending')`, [kot.lastInsertRowid, items[0].id]);
  await db.run(`UPDATE tables SET status = 'occupied', current_order_id = ? WHERE id = ?`, [orderId, table.id]);
  return orderId;
}

const activeItems = (db, orderId) =>
  db.get(`SELECT COUNT(*) n FROM order_items WHERE order_id = ? AND COALESCE(status,'') NOT IN ('voided','cancelled')`, [orderId])
    .then((r) => Number(r.n));

async function main() {
  const db = new PosDatabase(tmp);
  // Start from a clean floor — the demo seed occupies some tables.
  await db.run(`UPDATE orders SET status = 'cancelled' WHERE status NOT IN ('completed', 'cancelled')`);
  await db.run(`UPDATE tables SET status = 'available', current_order_id = NULL, waiter_id = NULL`);

  const tables = await db.all(`SELECT id, table_number FROM tables ORDER BY id LIMIT 3`);
  const menu = await db.all(`SELECT id, name, base_price FROM menu_items ORDER BY id LIMIT 3`);
  assert.ok(tables.length >= 3 && menu.length >= 3, 'need 3 tables + 3 menu items');
  const [t1, t2, t3] = tables;

  // --- merge: t2's order folds into t1's order ------------------------------
  const o1 = await seatOrder(db, t1, [menu[0], menu[1]]); // 2 items
  const o2 = await seatOrder(db, t2, [menu[2]]);          // 1 item
  const before1 = await activeItems(db, o1);
  const before2 = await activeItems(db, o2);
  assert.equal(before1, 2);
  assert.equal(before2, 1);

  const merge = await mergeTables(db, { source_table_id: t2.id, target_table_id: t1.id, reason: 'friends joined', created_by: null });
  assert.equal(merge.target_order_id, o1, 'survivor is t1 order');
  assert.equal(merge.merged_item_count, 3, 'all items on the survivor');
  assert.equal(await activeItems(db, o1), 3, 'target has both orders items');
  assert.equal(await activeItems(db, o2), 0, 'source has no active items');

  const src = await db.get(`SELECT status, merged_into_order_id FROM orders WHERE id = ?`, [o2]);
  assert.equal(src.status, 'cancelled', 'source order retired');
  assert.equal(Number(src.merged_into_order_id), Number(o1), 'source points at survivor');

  const t2row = await db.get(`SELECT status, current_order_id FROM tables WHERE id = ?`, [t2.id]);
  assert.equal(t2row.status, 'available', 'source table freed');
  assert.equal(t2row.current_order_id, null, 'source table has no order');

  const t1row = await db.get(`SELECT status, current_order_id FROM tables WHERE id = ?`, [t1.id]);
  assert.equal(t1row.status, 'occupied', 'target table still occupied');
  assert.equal(Number(t1row.current_order_id), Number(o1), 'target table keeps survivor');

  const movedKots = await db.get(`SELECT COUNT(*) n FROM kots WHERE order_id = ?`, [o1]);
  assert.equal(Number(movedKots.n), 2, 'both KOTs now hang off the survivor');
  const orphanKots = await db.get(`SELECT COUNT(*) n FROM kots WHERE order_id = ?`, [o2]);
  assert.equal(Number(orphanKots.n), 0, 'no KOTs left on the source');

  // --- transfer: survivor moves from t1 to the free t3 ----------------------
  const tr = await transferOrder(db, { order_id: o1, to_table_id: t3.id, reason: 'moved to window', created_by: null });
  assert.equal(Number(tr.to_table_id), Number(t3.id));
  const o1row = await db.get(`SELECT table_id, table_number FROM orders WHERE id = ?`, [o1]);
  assert.equal(Number(o1row.table_id), Number(t3.id), 'order now on t3');
  assert.equal(o1row.table_number, t3.table_number, 'table number updated');
  assert.equal((await db.get(`SELECT status, current_order_id FROM tables WHERE id = ?`, [t1.id])).status, 'available', 't1 freed');
  assert.equal(Number((await db.get(`SELECT current_order_id FROM tables WHERE id = ?`, [t3.id])).current_order_id), Number(o1), 't3 holds the order');

  // --- guards ---------------------------------------------------------------
  await assert.rejects(() => transferOrder(db, { order_id: o1, to_table_id: t3.id }), /already on this table/);
  // transfer onto an occupied table must be blocked (seat a fresh order on t1)
  const o3 = await seatOrder(db, t1, [menu[0]]);
  await assert.rejects(() => transferOrder(db, { order_id: o1, to_table_id: t1.id }), /already has an open order/);
  await assert.rejects(() => mergeTables(db, { source_order_id: o1, target_order_id: o1 }), /into itself/);

  // --- audit ----------------------------------------------------------------
  const ops = await listTableOps(db);
  assert.ok(ops.some((o) => o.action === 'merge'), 'merge logged');
  assert.ok(ops.some((o) => o.action === 'transfer'), 'transfer logged');

  db.close();
  console.log('✓ table-ops self-check passed');
}

main()
  .catch((e) => {
    console.error('✗ table-ops self-check FAILED');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });
