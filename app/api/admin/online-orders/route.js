import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { listOnlineOrders } from '@/lib/online-orders.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;
    const q = new URL(request.url).searchParams;
    const result = await listOnlineOrders(Database.getInstance(), {
      status: String(q.get('status') || 'ALL').toUpperCase(),
      source: String(q.get('source') || 'ALL').toUpperCase(),
    });
    return NextResponse.json({ orders: result.rows, counts: result.counts });
  } catch (error) {
    return handleRouteError(error, 'Failed to load online orders');
  }
}
