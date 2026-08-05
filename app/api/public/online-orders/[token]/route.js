import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { getOnlineOrderByToken } from '@/lib/online-orders.js';

export async function GET(_request, { params }) {
  const { token } = await params;
  const order = await getOnlineOrderByToken(Database.getInstance(), token);
  if (!order) return NextResponse.json({ error: 'Order request not found.' }, { status: 404 });
  return NextResponse.json({ order });
}
