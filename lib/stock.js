/**
 * Decrease inventory when menu/custom items are sold.
 *
 * A sold line resolves to an inventory row in exactly one way:
 *   1. an explicit `inventory_items.menu_item_id` link, created ONLY through
 *      the validated inventory form or the menu/product form, or
 *   2. failing that, the strict name match in resolveInventoryItem(), which
 *      deducts nothing unless the names match exactly (or near-exactly) and
 *      unambiguously.
 *
 * Nothing here ever WRITES a link. See the note at the bottom of this file.
 */

import { ensureColumn } from '@/lib/db/schema-helpers.js';
import {
  ensureRecipeTables,
  getRecipeByMenuItemId,
  explodeRecipe,
  deductRawMaterials,
} from '@/lib/recipes.js';
import { ensureStockMovementsTable } from '@/lib/stock-movements.js';
import { applyStockChange, resolveInventoryItem } from '@/lib/inventory-ledger.js';

// A variant with its own inventory_item_id + stock_quantity overrides the
// menu item's recipe/base link entirely — e.g. "60ml" and "120ml" pours of
// the same bottle draw different amounts, so the variant's own numbers win.
async function resolveVariantStockLink(db, menuId, variantName) {
  if (!menuId || !variantName) return null;
  const variant = await db.get(
    `SELECT * FROM menu_item_variants WHERE menu_item_id = ? AND variant_name = ?`,
    [menuId, variantName]
  );
  if (!variant?.inventory_item_id || !variant?.stock_quantity) return null;
  const row = await db.get(
    `SELECT * FROM inventory_items WHERE id = ? AND COALESCE(is_archived, 0) = 0`,
    [variant.inventory_item_id]
  );
  if (!row) return null;
  return { row, perUnit: Number(variant.stock_quantity) };
}

/**
 * Idempotent schema top-up for the tables the sold-line stock path touches.
 * Safe to call outside a transaction; callers that used to call
 * autoLinkBeverageStock() for this side effect should call this instead.
 */
export async function ensureStockSchema(db) {
  try {
    await ensureColumn(db, 'inventory_items', 'menu_item_id', 'INTEGER');
  } catch {
    /* ignore — already exists */
  }
  try {
    await ensureRecipeTables(db);
  } catch {
    /* ignore — already exists */
  }
  try {
    await ensureStockMovementsTable(db);
  } catch {
    /* ignore — already exists */
  }
}

/**
 * @param {object} db - PosDatabase instance
 * @param {Array<{menu_item_id?:number,name?:string,item_name?:string,quantity:number}>} items
 * @returns {Promise<{deducted: Array, warnings: Array}>}
 */
export async function deductStockForItems(db, items = [], context = {}) {
  await ensureStockSchema(db);
  const { orderId, performedBy } = context;
  const deducted = [];
  const warnings = [];

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    const menuId = item.menu_item_id || item.item_id || item.id || null;

    const variantLink = await resolveVariantStockLink(db, menuId, item.variant_name);
    if (variantLink) {
      const applied = await applyStockChange(db, {
        inventory_item_id: variantLink.row.id,
        quantity: -(variantLink.perUnit * qty),
        change_type: 'order_deduction',
        performed_by: performedBy,
        reason: item.item_name || item.name,
        reference_id: orderId,
      });
      if (applied) {
        deducted.push({ ...applied, sold: variantLink.perUnit * qty });
        if (applied.warning) warnings.push(applied.warning);
        const min = Number(variantLink.row.min_stock_level ?? variantLink.row.min_stock ?? 0);
        if (applied.to <= 0 && !applied.warning) warnings.push(`${applied.name} is now out of stock.`);
        else if (min > 0 && applied.to > 0 && applied.to <= min) warnings.push(`${applied.name} is running low (${applied.to} ${variantLink.row.unit || 'left'}).`);
      }
      continue;
    }

    const recipe = await getRecipeByMenuItemId(db, menuId);

    if (recipe) {
      const deltaMap = await explodeRecipe(db, recipe.id, qty);
      const result = await deductRawMaterials(db, deltaMap, {
        direction: -1,
        changeType: 'order_deduction',
        performedBy,
        reason: item.item_name || item.name || null,
        referenceId: orderId,
      });
      deducted.push(...result.deducted.map((d) => ({ ...d, sold: d.amount })));
      warnings.push(...result.warnings);
      continue;
    }

    const { row, warning } = await resolveInventoryItem(db, item);
    if (warning) warnings.push(warning);
    if (!row) continue;

    const applied = await applyStockChange(db, {
      inventory_item_id: row.id,
      quantity: -qty,
      change_type: 'order_deduction',
      performed_by: performedBy,
      reason: row.item_name || row.name,
      reference_id: orderId,
    });
    if (!applied) continue;

    deducted.push({ ...applied, sold: qty });
    if (applied.warning) warnings.push(applied.warning);

    const min = Number(row.min_stock_level ?? row.min_stock ?? 0);
    if (applied.to <= 0 && !applied.warning) {
      warnings.push(`${applied.name} is now out of stock.`);
    } else if (min > 0 && applied.to > 0 && applied.to <= min) {
      warnings.push(`${applied.name} is running low (${applied.to} ${row.unit || 'left'}).`);
    }
  }

  return { deducted, warnings };
}

/**
 * Restore inventory when items are voided/cancelled.
 */
export async function restoreStockForItems(db, items = [], context = {}) {
  await ensureStockSchema(db);
  const { performedBy, reason = 'Order item voided', orderId = null } = context;
  const restored = [];
  const warnings = [];

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    const menuId = item.menu_item_id || item.item_id || item.id || null;

    const variantLink = await resolveVariantStockLink(db, menuId, item.variant_name);
    if (variantLink) {
      const applied = await applyStockChange(db, {
        inventory_item_id: variantLink.row.id,
        quantity: variantLink.perUnit * qty,
        change_type: 'order_void',
        performed_by: performedBy,
        reason,
        reference_id: orderId,
      });
      if (applied) restored.push({ ...applied, restored: variantLink.perUnit * qty });
      continue;
    }

    const recipe = await getRecipeByMenuItemId(db, menuId);

    if (recipe) {
      const deltaMap = await explodeRecipe(db, recipe.id, qty);
      const result = await deductRawMaterials(db, deltaMap, {
        direction: 1,
        changeType: 'order_void',
        performedBy,
        reason,
        referenceId: orderId,
      });
      restored.push(...result.deducted.map((d) => ({ ...d, restored: d.amount })));
      continue;
    }

    const { row, warning } = await resolveInventoryItem(db, item);
    if (warning) warnings.push(warning);
    if (!row) continue;

    const applied = await applyStockChange(db, {
      inventory_item_id: row.id,
      quantity: qty,
      change_type: 'order_void',
      performed_by: performedBy,
      reason,
      reference_id: orderId,
    });
    if (applied) restored.push({ ...applied, restored: qty });
  }

  return { restored, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOVED: ensureBeverageInventory() / autoLinkBeverageStock()
//
// Do NOT reintroduce automatic inventory<->menu linking, here or anywhere on
// the order/bill path. The removed version ran on every order create, every
// add-items call and every bill, and wrote `inventory_items.menu_item_id`
// using a substring rule with no word boundary:
//
//     h.includes(n) || n.includes(h.split(' ')[0])
//
// Simulated against this project's real menu it wrote 15 wrong links out of
// 17, including menu "Steam Rice" -> raw material "Tea Leaves", because
// normalize("Steam Rice") === "steam rice" contains "tea" (s-TEA-m). Once that
// link exists, resolveInventoryItem() prefers it over any name match and every
// plate of rice sold drains the tea. It also never updated its in-memory copy
// after writing, so the LAST matching menu item won and the links churned on
// every single order (seven chicken dishes fought over one "Chicken Breast"
// row). Cost on the hot path was ~53 queries and 2 full table scans per order.
//
// It also CREATED inventory rows at request time ("Coke Cans" 48 @ 40, etc.)
// with invented opening balances, so a live database's entire inventory could
// be fabricated demo data — inflating stock valuation and food cost. That demo
// data now lives in scripts/seed-orders.mjs where it belongs.
//
// Links belong to the owner: create them in the inventory form
// (app/api/admin/inventory) or the menu/product form (app/api/admin/products),
// both of which validate one inventory item per menu item. Unlinked sold lines
// fall back to the deliberately strict matcher in lib/inventory-ledger.js.
// ─────────────────────────────────────────────────────────────────────────────
