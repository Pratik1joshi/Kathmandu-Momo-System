import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { markBillPrinted } from '@/lib/bill-reopen.js';
import { ensureCan } from '@/lib/permissions.js';

/**
 * POST — record that a proforma bill was printed for the customer to check,
 * WITHOUT taking payment. The order stays open; payment is a separate action
 * (POST /api/restaurant/bills/[orderId]/payment). Waiters may print too.
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier', 'waiter'] });
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
    }
    const db = Database.getInstance();
    await ensureCan(db, auth.user, 'print_bills');
    const row = await markBillPrinted(db, orderId);
    return NextResponse.json({ success: true, bill_printed_at: row?.bill_printed_at || null });
  } catch (error) {
    return handleRouteError(error, 'Could not record the bill print.');
  }
}
