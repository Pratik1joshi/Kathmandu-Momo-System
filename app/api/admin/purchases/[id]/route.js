import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureRecipeTables } from '@/lib/recipes.js';
import { getPurchase, updatePurchase, voidPurchase, deletePurchase } from '@/lib/purchases.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { id } = await params;
    const db = Database.getInstance();
    await ensureRecipeTables(db);

    const purchase = await getPurchase(db, id);
    if (!purchase) return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 });
    return NextResponse.json({ purchase });
  } catch (error) {
    return handleRouteError(error, 'Failed to load purchase');
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { id } = await params;
    const data = await request.json();
    const db = Database.getInstance();
    await ensureRecipeTables(db);

    const purchase = await updatePurchase(db, id, {
      ...data,
      received_by: data.received_by ?? auth.user?.id ?? null,
    });
    return NextResponse.json({ message: 'Purchase updated and stock re-applied.', purchase });
  } catch (error) {
    return handleRouteError(error, 'Failed to update purchase');
  }
}

/**
 * DELETE voids by default — the stock is reversed, the linked expense is
 * removed and the record is kept for audit. ?hard=1 only succeeds on a draft
 * or already-voided purchase.
 */
export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { id } = await params;
    const q = new URL(request.url).searchParams;
    const db = Database.getInstance();
    await ensureRecipeTables(db);

    if (q.get('hard') === '1') {
      return NextResponse.json(await deletePurchase(db, id));
    }

    const purchase = await voidPurchase(db, id, {
      reason: q.get('reason'),
      performedBy: auth.user?.id || null,
    });
    return NextResponse.json({ message: 'Purchase voided and stock reversed.', purchase });
  } catch (error) {
    return handleRouteError(error, 'Failed to void purchase');
  }
}
