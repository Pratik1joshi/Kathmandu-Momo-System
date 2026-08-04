import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensurePayrollSchema, listPayments, recordPayment, deletePayment } from '@/lib/payroll.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensurePayrollSchema(db);
    const employeeId = new URL(request.url).searchParams.get('employee_id');
    return NextResponse.json({ payments: await listPayments(db, employeeId) });
  } catch (error) {
    return handleRouteError(error, 'Failed to load payroll');
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensurePayrollSchema(db);
    const payment = await recordPayment(db, await request.json(), auth.user?.id || null);
    return NextResponse.json({ message: 'Payment recorded.', payment }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to record payment');
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Which payment should be removed?' }, { status: 400 });
    const db = Database.getInstance();
    await ensurePayrollSchema(db);
    await deletePayment(db, id);
    return NextResponse.json({ message: 'Payment deleted.' });
  } catch (error) {
    return handleRouteError(error, 'Failed to delete payment');
  }
}
