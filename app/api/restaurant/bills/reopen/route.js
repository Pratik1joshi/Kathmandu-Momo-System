import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { reopenBill, searchReopenableBills } from '@/lib/bill-reopen.js';
import { ensureCan } from '@/lib/permissions.js';
import { logger } from '@/lib/logger.js';

/** GET — search recently paid bills that can be reopened (find-previous-bill box). */
export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const bills = await searchReopenableBills(Database.getInstance(), {
      q: searchParams.get('q') || '',
      date: searchParams.get('date') || null,
      limit: Number(searchParams.get('limit')) || 25,
    });
    return NextResponse.json({ success: true, bills });
  } catch (error) {
    return handleRouteError(error, 'Could not search bills.');
  }
}

/**
 * POST - create a linked supplemental order for a paid bill.
 * Body: { bill_id | bill_number, reason }.
 * Returns the reactivated order so the client can jump straight to it.
 */
export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const reason = String(body.reason || '').trim();
    if (!reason) {
      return NextResponse.json({ error: 'A reason is required to reopen a bill.' }, { status: 400 });
    }
    if (!body.bill_id && !body.bill_number) {
      return NextResponse.json({ error: 'Which bill? Provide a bill id or number.' }, { status: 400 });
    }

    const db = Database.getInstance();
    await ensureCan(db, auth.user, 'reopen_bills');

    const result = await reopenBill(db, {
      bill_id: body.bill_id ? parseInt(body.bill_id, 10) : null,
      bill_number: body.bill_number || null,
      reason,
      created_by: auth.user.id,
    });

    logger.info('bill_reopened', {
      bill_id: result.bill_id,
      order_id: result.order_id,
      by: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: `Supplemental order created for ${result.bill_number}. Only added items will be billed.`,
      ...result,
    });
  } catch (error) {
    return handleRouteError(error, 'We could not reopen this bill. Please try again.');
  }
}
