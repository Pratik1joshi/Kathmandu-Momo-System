import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { getWaiterStats } from '@/lib/waiter-analytics.js';

/**
 * GET — waiter performance snapshot. A waiter always sees their own numbers;
 * admin/cashier may pass ?waiter_id= for anyone, or omit it for the whole floor.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier', 'waiter'] });
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    let waiterId = auth.user.role === 'waiter' ? auth.user.id : null;
    const asked = searchParams.get('waiter_id');
    if (asked && auth.user.role !== 'waiter') waiterId = parseInt(asked, 10);

    const stats = await getWaiterStats(Database.getInstance(), { waiter_id: waiterId });
    return NextResponse.json({ success: true, waiter_id: waiterId, stats });
  } catch (error) {
    return handleRouteError(error, 'Could not load your dashboard.');
  }
}
