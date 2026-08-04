import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureRecipeTables } from '@/lib/recipes.js';
import { previewPurchaseImport, commitPurchaseImport } from '@/lib/purchases.js';

/**
 * Bulk purchase import. Two steps on purpose:
 *   POST { mode: 'preview', rows } -> grouped purchases + per-row errors, no writes
 *   POST { mode: 'commit',  rows } -> creates each purchase transactionally
 *
 * Row columns: invoice_number, invoice_date, supplier, item_name, quantity,
 * unit_cost. Rows sharing an invoice_number become one purchase.
 * Quantities and unit costs are in PURCHASE units.
 */
export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const data = await request.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });

    const db = Database.getInstance();
    await ensureRecipeTables(db);

    if (data.mode !== 'commit') {
      return NextResponse.json({ mode: 'preview', ...(await previewPurchaseImport(db, rows)) });
    }

    // ponytail: each purchase commits in its own transaction, so a mid-import
    // failure leaves earlier purchases posted. Preview already refuses to
    // commit unless every row is valid, which makes that near-impossible.
    const result = await commitPurchaseImport(db, rows, { received_by: auth.user?.id || null });
    return NextResponse.json({
      mode: 'commit',
      message: `Created ${result.created_count} purchase(s).`,
      ...result,
    });
  } catch (error) {
    if (error?.status === 400 && error.preview) {
      return NextResponse.json({ error: error.message, preview: error.preview }, { status: 400 });
    }
    return handleRouteError(error, 'Failed to import purchases');
  }
}
