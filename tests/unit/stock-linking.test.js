/**
 * Guards the inventory <-> menu linkage rules.
 *
 * The bug these lock down: an auto-linker used to run on every order create,
 * add-items call and bill, writing `inventory_items.menu_item_id` from a
 * substring match with no word boundary. Against this project's real menu it
 * linked "Steam Rice" to the raw material "Tea Leaves" (because "s-TEA-m"
 * contains "tea"), after which every plate of rice sold drained the tea.
 *
 * These tests drive the real lib/stock.js against a stub db that records every
 * statement, so they assert on the SQL that goes in — which is where the
 * damage was done.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { deductStockForItems, restoreStockForItems, ensureStockSchema } from '@/lib/stock.js';

/**
 * Stub db. `answers` is a list of [substring, rows] pairs; first hit wins.
 */
function stubDb(answers = []) {
  const statements = [];
  const lookup = (sql) => {
    for (const [needle, rows] of answers) if (sql.includes(needle)) return rows;
    return [];
  };
  const db = {
    driver: 'sqlite',
    statements,
    async all(sql, params = []) { statements.push({ sql, params }); return lookup(sql); },
    async get(sql, params = []) { statements.push({ sql, params }); return lookup(sql)[0] ?? undefined; },
    async run(sql, params = []) { statements.push({ sql, params }); return { lastInsertRowid: 1, changes: 1 }; },
    async exec(sql) { statements.push({ sql, params: [] }); },
    async transaction(fn) { return fn(db); },
  };
  return db;
}

const linkWrites = (db) =>
  db.statements.filter((s) => /UPDATE\s+inventory_items[\s\S]*menu_item_id\s*=/i.test(s.sql));

const inventoryInserts = (db) =>
  db.statements.filter((s) => /INSERT\s+INTO\s+inventory_items/i.test(s.sql));

/** Real menu names and realistic raw materials from this project's database. */
const RAW_MATERIALS = [
  { id: 1, item_name: 'Tea Leaves', quantity: 5000, unit: 'g', cost_per_unit: 0.8, min_stock_level: 100 },
  { id: 2, item_name: 'Basmati Rice', quantity: 25000, unit: 'g', cost_per_unit: 0.12, min_stock_level: 100 },
  { id: 3, item_name: 'Chicken Breast', quantity: 10000, unit: 'g', cost_per_unit: 0.45, min_stock_level: 100 },
];

test('selling a menu item never writes an inventory link', async () => {
  const db = stubDb([['FROM inventory_items WHERE COALESCE(is_archived, 0) = 0', RAW_MATERIALS]]);

  await deductStockForItems(db, [{ menu_item_id: 21, item_name: 'Steam Rice', quantity: 3 }], { orderId: 9001 });

  assert.deepEqual(linkWrites(db), [], 'the sold-line path must not write inventory_items.menu_item_id');
});

test('"Steam Rice" does not resolve to "Tea Leaves" and deducts nothing', async () => {
  const db = stubDb([['FROM inventory_items WHERE COALESCE(is_archived, 0) = 0', RAW_MATERIALS]]);

  const { deducted, warnings } = await deductStockForItems(
    db,
    [{ menu_item_id: 21, item_name: 'Steam Rice', quantity: 3 }],
    { orderId: 9001 }
  );

  assert.deepEqual(deducted, [], 'an unlinked menu item with no name match must deduct nothing');
  assert.deepEqual(warnings, []);
  assert.equal(
    db.statements.filter((s) => /INSERT INTO stock_movements/i.test(s.sql)).length,
    0,
    'no stock movement may be written for a line that matched nothing'
  );
});

test('the sold-line path never creates inventory rows (no runtime demo seeding)', async () => {
  const db = stubDb([['FROM inventory_items WHERE COALESCE(is_archived, 0) = 0', RAW_MATERIALS]]);

  await deductStockForItems(db, [{ menu_item_id: 31, item_name: 'Coke', quantity: 2 }], { orderId: 9002 });
  await restoreStockForItems(db, [{ menu_item_id: 31, item_name: 'Coke', quantity: 2 }], { orderId: 9002 });

  assert.deepEqual(inventoryInserts(db), [], 'inventory rows belong to the seed script, not to request handlers');
});

test('an explicit link is honoured, and only that row is touched', async () => {
  const linked = { id: 7, item_name: 'Coke Cans', quantity: 48, unit: 'pcs', cost_per_unit: 40, min_stock_level: 6, menu_item_id: 31 };
  const db = stubDb([
    ['FROM inventory_items WHERE menu_item_id = ?', [linked]],
    ['FROM inventory_items WHERE id = ?', [linked]],
  ]);

  const { deducted } = await deductStockForItems(db, [{ menu_item_id: 31, item_name: 'Coke', quantity: 2 }], { orderId: 9003 });

  assert.equal(deducted.length, 1);
  assert.equal(deducted[0].inventory_item_id, 7);
  assert.equal(deducted[0].applied, -2);
  assert.deepEqual(linkWrites(db), [], 'honouring a link must not rewrite it');
});

test('an exact name match still resolves for an unlinked sold line', async () => {
  const rows = [{ id: 3, item_name: 'Chicken Breast', quantity: 10000, unit: 'g', cost_per_unit: 0.45, min_stock_level: 100 }];
  const db = stubDb([
    ['FROM inventory_items WHERE COALESCE(is_archived, 0) = 0', rows],
    ['FROM inventory_items WHERE id = ?', rows],
  ]);

  const { deducted } = await deductStockForItems(db, [{ item_name: 'Chicken Breast', quantity: 4 }], { orderId: 9004 });

  assert.equal(deducted.length, 1, 'strict name matching is deliberately kept for unlinked lines');
  assert.equal(deducted[0].inventory_item_id, 3);
});

test('ensureStockSchema only tops up schema — it writes no data', async () => {
  const db = stubDb();
  await ensureStockSchema(db);

  assert.deepEqual(linkWrites(db), []);
  assert.deepEqual(inventoryInserts(db), []);
});
