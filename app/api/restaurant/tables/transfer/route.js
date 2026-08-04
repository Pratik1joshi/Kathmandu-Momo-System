import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { transferOrder } from '@/lib/table-ops.js';
import { ensureCan } from '@/lib/permissions.js';
import { logger } from '@/lib/logger.js';

/**
 * POST — move an open dine-in order to another (free) table.
 * Body: { order_id, to_table_id, reason }.
 */
export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier', 'waiter'] });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const num = (v) => (v == null ? null : parseInt(v, 10));
    if ((!body.order_id && !body.from_table_id) || !body.to_table_id) {
      return NextResponse.json({ error: 'Pick an order (or its table) and a destination table.' }, { status: 400 });
    }
    const db = Database.getInstance();
    await ensureCan(db, auth.user, 'transfer_tables');
    const result = await transferOrder(db, {
      order_id: num(body.order_id),
      from_table_id: num(body.from_table_id),
      to_table_id: num(body.to_table_id),
      reason: String(body.reason || '').trim(),
      created_by: auth.user.id,
    });
    logger.info('table_transfer', { order_id: result.order_id, to: result.to_table_id, by: auth.user.id });
    return NextResponse.json({ success: true, message: `Order moved to table ${result.to_table_number}.`, ...result });
  } catch (error) {
    return handleRouteError(error, 'Could not transfer the table.');
  }
}
