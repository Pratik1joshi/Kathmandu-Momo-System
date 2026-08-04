import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureRecipeTables } from '@/lib/recipes.js';
import { createPurchase, listPurchases } from '@/lib/purchases.js';
import { readListParams } from '@/lib/paginate.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const db = Database.getInstance();
    await ensureRecipeTables(db);

    const q = new URL(request.url).searchParams;
    const filters = {
      supplierId: q.get('supplier_id'),
      status: q.get('status'),
      from: q.get('from'),
      to: q.get('to'),
    };

    const { rows, pagination, summary } = await listPurchases(db, { ...readListParams(q), ...filters });
    return NextResponse.json({ purchases: rows, pagination, summary });
  } catch (error) {
    return handleRouteError(error, 'Failed to load purchases');
  }
}

/**
 * One transactional receipt: header + lines + stock + movements + expense.
 * Quantities and unit costs are in PURCHASE units.
 */
export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const data = await request.json();
    const db = Database.getInstance();
    await ensureRecipeTables(db);

    const purchase = await createPurchase(db, {
      ...data,
      received_by: data.received_by ?? auth.user?.id ?? null,
    });
    return NextResponse.json({ message: 'Delivery received and stock updated.', purchase }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to record purchase');
  }
}
