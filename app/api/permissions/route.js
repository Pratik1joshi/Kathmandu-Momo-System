import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { effectivePermissions, PERMISSION_ACTIONS } from '@/lib/permissions.js';

/**
 * GET — the signed-in user's own effective permissions, for UI gating.
 * Any authenticated role; the answer is scoped to that role (admin = all).
 */
export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin', 'cashier', 'waiter', 'kitchen'] });
  if (auth.error) return auth.error;
  try {
    const permissions = await effectivePermissions(Database.getInstance(), auth.user.role);
    return NextResponse.json({ success: true, role: auth.user.role, permissions, actions: PERMISSION_ACTIONS });
  } catch (error) {
    return handleRouteError(error, 'Could not load permissions.');
  }
}
