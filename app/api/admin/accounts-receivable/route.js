import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureAccountingSchema } from '@/lib/accounting.js';
import { listBankAccounts } from '@/lib/accounting-cash.js';
import {
  customerReceivables,
  receivableAgeing,
  customerArStatement,
  collectCustomerCredit,
  arAccountBalance,
} from '@/lib/accounting-receivables.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensureAccountingSchema(db);
    const q = new URL(request.url).searchParams;

    const customerId = q.get('customer_id');
    if (customerId) {
      return NextResponse.json({
        statement: await customerArStatement(db, customerId, { from: q.get('from'), to: q.get('to') }),
      });
    }

    const [receivables, ageing, ar_balance, banks] = await Promise.all([
      customerReceivables(db),
      receivableAgeing(db),
      arAccountBalance(db),
      listBankAccounts(db),
    ]);
    return NextResponse.json({ receivables, ageing, ar_balance, banks });
  } catch (error) {
    return handleRouteError(error, 'Failed to load accounts receivable');
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensureAccountingSchema(db);
    const body = await request.json();
    const result = await collectCustomerCredit(db, {
      ...body,
      actorId: auth.user?.id || null,
      actorRole: auth.user?.role || 'admin',
    });
    return NextResponse.json({ message: 'Customer payment recorded.', ...result }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to record customer payment');
  }
}
