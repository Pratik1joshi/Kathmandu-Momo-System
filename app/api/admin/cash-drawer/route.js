import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureAccountingSchema } from '@/lib/accounting.js';
import { listDrawers, listSessions, openSession, closeSession, createDrawer } from '@/lib/accounting-cash.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensureAccountingSchema(db);
    const q = new URL(request.url).searchParams;
    const [drawers, sessions] = await Promise.all([
      listDrawers(db),
      listSessions(db, { drawerId: q.get('drawer_id') }),
    ]);
    const open = sessions.find((s) => s.status === 'open') || null;
    return NextResponse.json({ drawers, sessions, open });
  } catch (error) {
    return handleRouteError(error, 'Failed to load cash drawer');
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensureAccountingSchema(db);
    const data = await request.json();
    if (data.action === 'add_drawer') {
      return NextResponse.json({ drawer: await createDrawer(db, data.name) }, { status: 201 });
    }
    const session = await openSession(db, { ...data, opened_by: auth.user?.id || null });
    return NextResponse.json({ message: 'Drawer opened.', session }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to open drawer');
  }
}

export async function PUT(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;
    const db = Database.getInstance();
    await ensureAccountingSchema(db);
    const data = await request.json();
    const session = await closeSession(db, { ...data, closed_by: auth.user?.id || null });
    return NextResponse.json({ message: 'Drawer closed.', session });
  } catch (error) {
    return handleRouteError(error, 'Failed to close drawer');
  }
}
