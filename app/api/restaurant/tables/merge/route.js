import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { mergeTables } from '@/lib/table-ops.js';
import { ensureCan } from '@/lib/permissions.js';
import { logger } from '@/lib/logger.js';

/**
 * POST — merge two occupied tables into one bill. The source folds into the
 * target; the source table is freed. Accepts table ids or order ids.
 * Body: { source_table_id | source_order_id, target_table_id | target_order_id, reason }.
 */
export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier', 'waiter'] });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const num = (v) => (v == null ? null : parseInt(v, 10));
    const db = Database.getInstance();
    await ensureCan(db, auth.user, 'merge_tables');
    const result = await mergeTables(db, {
      source_order_id: num(body.source_order_id),
      target_order_id: num(body.target_order_id),
      source_table_id: num(body.source_table_id),
      target_table_id: num(body.target_table_id),
      reason: String(body.reason || '').trim(),
      created_by: auth.user.id,
    });
    logger.info('table_merge', {
      target: result.target_order_id,
      source: result.source_order_id,
      by: auth.user.id,
    });
    return NextResponse.json({
      success: true,
      message: `Merged into order ${result.target_order_number} — ${result.merged_item_count} items on one bill.`,
      ...result,
    });
  } catch (error) {
    return handleRouteError(error, 'Could not merge the tables.');
  }
}
