import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { searchOrderHistory } from '@/lib/order-history.js';

/**
 * GET — order history for the waiter/cashier history screens.
 * Query: q, scope (today|active|completed|all), date, mine=1.
 * A waiter can see everyone's orders (floor coordination), but `mine=1`
 * restricts to their own.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier', 'waiter'] });
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const rows = await searchOrderHistory(Database.getInstance(), {
      q: searchParams.get('q') || '',
      scope: searchParams.get('scope') || 'today',
      date: searchParams.get('date') || null,
      mine: searchParams.get('mine') === '1',
      waiter_id: auth.user.id,
      limit: Number(searchParams.get('limit')) || 60,
    });
    return NextResponse.json({ success: true, orders: rows });
  } catch (error) {
    return handleRouteError(error, 'Could not load order history.');
  }
}
