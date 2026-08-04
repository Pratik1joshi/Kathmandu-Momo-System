/**
 * Restaurant role permissions — one shared service used by every module.
 *
 * Admin always has full access. Waiter and cashier have sensible defaults that
 * the admin can override in Settings; overrides live in system_settings under
 * 'role_permissions' (JSON) so a change takes effect on the very next request —
 * permissions are read fresh from the DB, never baked into a build.
 *
 * Enforce on the server with ensureCan(db, user, action); gate the UI with the
 * effective map from /api/permissions.
 */

export const PERMISSION_ACTIONS = [
  { key: 'create_orders', label: 'Create orders' },
  { key: 'edit_orders', label: 'Edit orders / add items' },
  { key: 'send_kot', label: 'Send KOT' },
  { key: 'view_bills', label: 'View bills' },
  { key: 'print_bills', label: 'Print bills' },
  { key: 'apply_discounts', label: 'Apply discounts' },
  { key: 'complete_payments', label: 'Complete payments' },
  { key: 'split_payment', label: 'Split payment' },
  { key: 'reopen_bills', label: 'Reopen bills' },
  { key: 'void_bills', label: 'Void bills' },
  { key: 'refund_bills', label: 'Refund bills' },
  { key: 'transfer_tables', label: 'Transfer tables' },
  { key: 'merge_tables', label: 'Merge tables' },
  { key: 'access_reports', label: 'Access reports' },
];

const ALL_KEYS = PERMISSION_ACTIONS.map((a) => a.key);

const DEFAULTS = {
  waiter: {
    create_orders: true, edit_orders: true, send_kot: true, view_bills: true, print_bills: true,
    apply_discounts: false, complete_payments: false, split_payment: false, reopen_bills: false,
    void_bills: false, refund_bills: false, transfer_tables: true, merge_tables: false, access_reports: false,
  },
  cashier: {
    create_orders: true, edit_orders: true, send_kot: true, view_bills: true, print_bills: true,
    apply_discounts: true, complete_payments: true, split_payment: true, reopen_bills: true,
    void_bills: false, refund_bills: false, transfer_tables: true, merge_tables: true, access_reports: true,
  },
};

const CONFIGURABLE_ROLES = ['waiter', 'cashier'];

function fullMap(value = true) {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, value]));
}

/** Merge stored overrides over the defaults for the configurable roles. */
export async function getRolePermissions(db) {
  let stored = {};
  try {
    const row = await db.get(`SELECT setting_value FROM system_settings WHERE setting_key = 'role_permissions'`);
    if (row?.setting_value) stored = JSON.parse(row.setting_value);
  } catch {
    stored = {};
  }
  const out = {};
  for (const role of CONFIGURABLE_ROLES) {
    out[role] = { ...DEFAULTS[role] };
    const o = stored[role];
    if (o && typeof o === 'object') {
      for (const k of ALL_KEYS) if (typeof o[k] === 'boolean') out[role][k] = o[k];
    }
  }
  out.admin = fullMap(true); // always full
  return out;
}

/** The effective permission map for one user's role (admin = everything). */
export async function effectivePermissions(db, role) {
  if (role === 'admin') return fullMap(true);
  const all = await getRolePermissions(db);
  return all[role] || fullMap(false);
}

export function hasPermission(map, action) {
  return !!map?.[action];
}

/** Server guard: throw 403 unless the user's role may perform `action`. */
export async function ensureCan(db, user, action) {
  if (!user) throw Object.assign(new Error('Please sign in again to continue.'), { status: 401 });
  if (user.role === 'admin') return true;
  const map = await effectivePermissions(db, user.role);
  if (!map[action]) {
    throw Object.assign(new Error('You do not have permission for this action.'), { status: 403, code: 'forbidden' });
  }
  return true;
}

/** Admin saves overrides. Only configurable roles + known keys are persisted. */
export async function saveRolePermissions(db, patch) {
  const current = await getRolePermissions(db);
  const next = {};
  for (const role of CONFIGURABLE_ROLES) {
    next[role] = { ...current[role] };
    const p = patch?.[role];
    if (p && typeof p === 'object') {
      for (const k of ALL_KEYS) if (typeof p[k] === 'boolean') next[role][k] = p[k];
    }
  }
  const value = JSON.stringify(next);
  // Upsert — works on both SQLite and Postgres (system_settings.setting_key is unique).
  await db.run(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES ('role_permissions', ?)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`,
    [value]
  );
  return next;
}
