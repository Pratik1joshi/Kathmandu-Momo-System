import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { getRolePermissions, saveRolePermissions, PERMISSION_ACTIONS } from '@/lib/permissions.js';

/** GET — the full role→permission matrix (admin configures waiter + cashier). */
export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const permissions = await getRolePermissions(Database.getInstance());
    return NextResponse.json({ success: true, permissions, actions: PERMISSION_ACTIONS });
  } catch (error) {
    return handleRouteError(error, 'Could not load permissions.');
  }
}

/** PUT — save overrides for waiter/cashier. Admin stays full access. */
export async function PUT(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const permissions = await saveRolePermissions(Database.getInstance(), body.permissions || body);
    return NextResponse.json({ success: true, permissions });
  } catch (error) {
    return handleRouteError(error, 'Could not save permissions.');
  }
}
