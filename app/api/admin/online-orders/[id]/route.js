import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { acceptOnlineOrder, onlineOrderDetail, transitionOnlineOrder } from '@/lib/online-orders.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;
    const { id } = await params;
    const order = await onlineOrderDetail(Database.getInstance(), Number(id));
    if (!order) return NextResponse.json({ error: 'Order request not found.' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error, 'Failed to load order request');
  }
}

export async function PATCH(request, { params }) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;
    const { id } = await params;
    const body = await request.json();
    const db = Database.getInstance();
    const order = body.action === 'accept'
      ? await acceptOnlineOrder(db, Number(id), auth.user)
      : await transitionOnlineOrder(db, Number(id), body.action, auth.user, body.reason);
    return NextResponse.json({ success: true, order });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return handleRouteError(error, 'Failed to update order request');
  }
}
