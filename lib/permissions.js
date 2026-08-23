/**
 * Admin-configurable permissions for a curated set of sensitive actions.
 *
 * Everything else (routes/menus/etc.) keeps using the static role arrays
 * already in lib/auth/auth.js — only these keys are toggle-able from
 * /admin/permissions. Defaults reproduce today's hardcoded behavior exactly,
 * so nothing changes for anyone until an admin edits the matrix.
 */
import { ensureColumn, serialPkSql } from './db/schema-helpers.js';
import { ensureSqliteTable } from './db/ensure-sqlite-table.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export const MANAGED_ROLES = ['waiter', 'cashier', 'kitchen'];

export const PERMISSION_CATALOG = [
  { key: 'orders.cancel', label: 'Cancel an order', category: 'Orders', description: 'Cancel or void an in-progress order from POS/admin.' },
  { key: 'orders.cancel_item', label: 'Remove a sent item', category: 'Orders', description: 'Remove an already-sent item from an order.' },
  { key: 'kots.cancel', label: 'Cancel a KOT', category: 'Kitchen', description: 'Cancel a kitchen order ticket.' },
  { key: 'bills.void', label: 'Void a paid bill', category: 'Billing', description: 'Void a bill that has already been paid.' },
  { key: 'bills.refund', label: 'Refund a bill', category: 'Billing', description: 'Issue a full or partial refund on a bill.' },
  { key: 'bills.reopen', label: 'Reopen a closed bill', category: 'Billing', description: 'Reopen a paid bill to add or change items.' },
  { key: 'bills.discount', label: 'Apply a discount', category: 'Billing', description: 'Apply or override a discount on a bill.' },
  { key: 'credit.writeoff', label: 'Discount customer credit', category: 'Billing', roles: ['cashier'], description: 'Reduce an existing customer credit balance with a recorded reason and audit trail.' },
  { key: 'purchases.view', label: 'View purchases', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'View purchase history, delivery lines and linked stock/expense records.' },
  { key: 'purchases.create', label: 'Receive a purchase', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'Record a received delivery and update inventory and expenses.' },
  { key: 'purchases.import', label: 'Import purchases', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'Upload and commit multiple invoice lines from CSV after previewing them.' },
  { key: 'purchases.edit', label: 'Edit a purchase', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'Correct an existing delivery and safely re-apply its stock movement.' },
  { key: 'purchases.void', label: 'Void a purchase', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'Reverse a purchase, its stock and its linked expense.' },
  { key: 'suppliers.view', label: 'View suppliers', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'View supplier contact details and purchase history.' },
  { key: 'suppliers.manage', label: 'Create or edit suppliers', category: 'Purchases & Suppliers', roles: ['cashier'], description: 'Create suppliers and update their contact details. Supplier merging remains admin-only.' },
  { key: 'payroll.view', label: 'View salary & advances', category: 'Payroll', roles: ['cashier'], description: 'View employee salary amounts, advance balances and payroll history.' },
  { key: 'payroll.advances.create', label: 'Give salary advances', category: 'Payroll', roles: ['cashier'], description: 'Pay and record a salary advance for an employee. Salary payments remain admin-only.' },
  { key: 'reports.view', label: 'View cashier reports', category: 'Manager Workspace', roles: ['cashier'], description: 'View operational sales, payment and item reports from the cashier workspace.' },
  { key: 'dashboard.view', label: 'View management dashboard', category: 'Manager Workspace', roles: ['cashier'], description: 'View the live management dashboard with sales, order, table and stock indicators.' },
  { key: 'menu.manage', label: 'Manage menu setup', category: 'Manager Workspace', roles: ['cashier'], description: 'Create and edit menu items, menu categories and recipes.' },
  { key: 'delivery.manage', label: 'Manage delivery executives', category: 'Manager Workspace', roles: ['cashier'], description: 'View, create and update delivery executives and their assigned orders.' },
  { key: 'inventory.dashboard.view', label: 'View inventory dashboard', category: 'Inventory Controls', roles: ['cashier'], description: 'View inventory health, value, movement and consumption analytics.' },
  { key: 'inventory.manage', label: 'Manage inventory items', category: 'Inventory Controls', roles: ['cashier'], description: 'Create, edit, archive and manually adjust inventory items. Quantity adjustments still require a reason.' },
  { key: 'inventory.setup.manage', label: 'Manage inventory setup', category: 'Inventory Controls', roles: ['cashier'], description: 'Manage inventory categories and unit conversions.' },
  { key: 'wastage.manage', label: 'Record and view wastage', category: 'Inventory Controls', roles: ['cashier'], description: 'Record wastage and view the complete wastage history.' },
  { key: 'expenses.manage', label: 'Record and view expenses', category: 'Cash & Accounting', roles: ['cashier'], description: 'View and record operating expenses.' },
  { key: 'savings.manage', label: 'Manage savings deposits', category: 'Cash & Accounting', roles: ['cashier'], description: 'View, create and void Savings & Deposits transfers with audit reasons.' },
  { key: 'cash_exchange.manage', label: 'Record cash exchange', category: 'Cash & Accounting', roles: ['cashier'], description: 'View and record note-exchange transactions during an open business day.' },
  { key: 'cash_drawer.manage', label: 'Operate cash drawer', category: 'Cash & Accounting', roles: ['cashier'], description: 'Open and close drawer sessions and record cash-in or cash-out movements.' },
  { key: 'business_days.view', label: 'View opening & closing', category: 'Cash & Accounting', roles: ['cashier'], description: 'View current and historical business-day sessions.' },
  { key: 'business_days.open', label: 'Open business day', category: 'Cash & Accounting', roles: ['cashier'], description: 'Open a new restaurant business day.' },
  { key: 'business_days.close', label: 'Close business day', category: 'Cash & Accounting', roles: ['cashier'], description: 'Close a normal business day after its blockers are resolved. Forced closing remains admin-only.' },
  { key: 'corrections.manage', label: 'Post accounting corrections', category: 'Cash & Accounting', roles: ['cashier'], description: 'View corrections and post audited journal reversals, bill voids and refunds.' },
  { key: 'general_ledger.view', label: 'View general ledger', category: 'Cash & Accounting', roles: ['cashier'], description: 'View journal entries and account ledgers without changing the chart of accounts.' },
  { key: 'hrm.departments.manage', label: 'Manage departments', category: 'HRM', roles: ['cashier'], description: 'Create, edit and remove departments.' },
  { key: 'hrm.designations.manage', label: 'Manage designations', category: 'HRM', roles: ['cashier'], description: 'Create, edit and remove designations.' },
  { key: 'hrm.attendance.manage', label: 'Mark staff attendance', category: 'HRM', roles: ['cashier'], description: 'View and mark the daily staff attendance register.' },
  { key: 'hrm.holidays.manage', label: 'Manage holidays', category: 'HRM', roles: ['cashier'], description: 'Add and remove entries on the holiday calendar.' },
  { key: 'pos.access', label: 'Access POS', category: 'Cashier: Core', roles: ['cashier'], description: 'Open the cashier POS and create or settle orders.' },
  { key: 'order_desk.access', label: 'Access Order Desk', category: 'Cashier: Core', roles: ['cashier'], description: 'View the cashier order desk and current service activity.' },
  { key: 'customers.access', label: 'Access Customers', category: 'Cashier: Core', roles: ['cashier'], description: 'View and manage customer records.' },
  { key: 'customer_ledger.access', label: 'Access Customer Ledger', category: 'Cashier: Core', roles: ['cashier'], description: 'View and maintain customer receivables.' },
  { key: 'supplier_ledger.access', label: 'Access Supplier Ledger', category: 'Cashier: Core', roles: ['cashier'], description: 'View and maintain supplier payables.' },
  { key: 'waiter_calls.access', label: 'Access Waiter Calls', category: 'Cashier: Operations', roles: ['cashier'], description: 'Receive and resolve waiter calls.' },
  { key: 'online_orders.access', label: 'Access Online Orders', category: 'Cashier: Operations', roles: ['cashier'], description: 'View and process online orders.' },
  { key: 'reservations.access', label: 'Access Reservations', category: 'Cashier: Operations', roles: ['cashier'], description: 'View and manage reservations.' },
  { key: 'bills.access', label: 'Access Bills', category: 'Cashier: Operations', roles: ['cashier'], description: 'View bills and complete billing work.' },
  { key: 'kot_history.access', label: 'Access KOT History', category: 'Cashier: Operations', roles: ['cashier'], description: 'View kitchen order ticket history.' },
  { key: 'payments.access', label: 'Access Payments', category: 'Cashier: Operations', roles: ['cashier'], description: 'View payment history.' },
  { key: 'finance_dashboard.access', label: 'Access Finance Dashboard', category: 'Cashier: Accounting', roles: ['cashier'], description: 'View the finance overview and balances.' },
  { key: 'chart_of_accounts.access', label: 'Access Chart of Accounts', category: 'Cashier: Accounting', roles: ['cashier'], description: 'View and manage the chart of accounts.' },
  { key: 'bank_reconciliation.access', label: 'Access Bank Reconciliation', category: 'Cashier: Accounting', roles: ['cashier'], description: 'Reconcile bank statements and ledger lines.' },
  { key: 'bank.access', label: 'Access Bank', category: 'Cashier: Accounting', roles: ['cashier'], description: 'Manage bank accounts and bank transactions.' },
  { key: 'settlements.access', label: 'Access Settlements', category: 'Cashier: Accounting', roles: ['cashier'], description: 'View and post payment settlements.' },
  { key: 'financial_reports.access', label: 'Access Financial Reports', category: 'Cashier: Accounting', roles: ['cashier'], description: 'View financial statements and accounting reports.' },
];
const CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));
const CATALOG_BY_KEY = new Map(PERMISSION_CATALOG.map((p) => [p.key, p]));
export const DYNAMIC_PERMISSION_KEYS = CATALOG_KEYS;

// Reproduces the role arrays / in-handler checks these actions were gated by
// before this feature existed. Used to seed new rows and as the fallback
// while the cache is cold.
const DEFAULTS = {
  'orders.cancel': { waiter: true, cashier: true, kitchen: false },
  'orders.cancel_item': { waiter: true, cashier: true, kitchen: false },
  'kots.cancel': { waiter: true, cashier: true, kitchen: false },
  'bills.void': { waiter: false, cashier: true, kitchen: false },
  'bills.refund': { waiter: false, cashier: true, kitchen: false },
  'bills.reopen': { waiter: false, cashier: true, kitchen: false },
  'bills.discount': { waiter: true, cashier: true, kitchen: false },
  'credit.writeoff': { waiter: false, cashier: true, kitchen: false },
  'purchases.view': { waiter: false, cashier: true, kitchen: false },
  'purchases.create': { waiter: false, cashier: true, kitchen: false },
  'purchases.import': { waiter: false, cashier: true, kitchen: false },
  'purchases.edit': { waiter: false, cashier: true, kitchen: false },
  'purchases.void': { waiter: false, cashier: true, kitchen: false },
  'suppliers.view': { waiter: false, cashier: true, kitchen: false },
  'suppliers.manage': { waiter: false, cashier: true, kitchen: false },
  'payroll.view': { waiter: false, cashier: true, kitchen: false },
  'payroll.advances.create': { waiter: false, cashier: true, kitchen: false },
  'reports.view': { waiter: false, cashier: true, kitchen: false },
  'dashboard.view': { waiter: false, cashier: true, kitchen: false },
  'menu.manage': { waiter: false, cashier: true, kitchen: false },
  'delivery.manage': { waiter: false, cashier: true, kitchen: false },
  'inventory.dashboard.view': { waiter: false, cashier: true, kitchen: false },
  'inventory.manage': { waiter: false, cashier: true, kitchen: false },
  'inventory.setup.manage': { waiter: false, cashier: true, kitchen: false },
  'wastage.manage': { waiter: false, cashier: true, kitchen: false },
  'expenses.manage': { waiter: false, cashier: true, kitchen: false },
  'savings.manage': { waiter: false, cashier: true, kitchen: false },
  'cash_exchange.manage': { waiter: false, cashier: true, kitchen: false },
  'cash_drawer.manage': { waiter: false, cashier: true, kitchen: false },
  'business_days.view': { waiter: false, cashier: true, kitchen: false },
  'business_days.open': { waiter: false, cashier: true, kitchen: false },
  'business_days.close': { waiter: false, cashier: true, kitchen: false },
  'corrections.manage': { waiter: false, cashier: true, kitchen: false },
  'general_ledger.view': { waiter: false, cashier: true, kitchen: false },
  'hrm.departments.manage': { waiter: false, cashier: false, kitchen: false },
  'hrm.designations.manage': { waiter: false, cashier: false, kitchen: false },
  'hrm.attendance.manage': { waiter: false, cashier: false, kitchen: false },
  'hrm.holidays.manage': { waiter: false, cashier: false, kitchen: false },
  'pos.access': { waiter: false, cashier: true, kitchen: false },
  'order_desk.access': { waiter: false, cashier: true, kitchen: false },
  'customers.access': { waiter: true, cashier: true, kitchen: false },
  'customer_ledger.access': { waiter: false, cashier: true, kitchen: false },
  'supplier_ledger.access': { waiter: false, cashier: true, kitchen: false },
  'waiter_calls.access': { waiter: false, cashier: true, kitchen: false },
  'online_orders.access': { waiter: false, cashier: true, kitchen: false },
  'reservations.access': { waiter: false, cashier: true, kitchen: false },
  'bills.access': { waiter: true, cashier: true, kitchen: false },
  'kot_history.access': { waiter: true, cashier: true, kitchen: true },
  'payments.access': { waiter: false, cashier: true, kitchen: false },
  'finance_dashboard.access': { waiter: false, cashier: true, kitchen: false },
  'chart_of_accounts.access': { waiter: false, cashier: true, kitchen: false },
  'bank_reconciliation.access': { waiter: false, cashier: true, kitchen: false },
  'bank.access': { waiter: false, cashier: true, kitchen: false },
  'settlements.access': { waiter: false, cashier: true, kitchen: false },
  'financial_reports.access': { waiter: false, cashier: true, kitchen: false },
};

export async function ensurePermissionsSchema(db) {
  if (db.driver === 'postgres') {
    const ready = await db.get(`SELECT to_regclass('public.role_permissions') AS t`);
    if (!ready?.t) fail('Permissions schema is not installed. Run database migration 038.', 503);
    return;
  }
  const pk = serialPkSql(db);
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL, permission_key TEXT NOT NULL, allowed INTEGER NOT NULL DEFAULT 0,
    updated_by INTEGER, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role, permission_key))`);
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS permission_audit (
    ${pk}, role TEXT NOT NULL, permission_key TEXT NOT NULL, previous_value INTEGER,
    new_value INTEGER NOT NULL, actor_id INTEGER, actor_name TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await ensureColumn(db, 'role_permissions', 'updated_by', 'INTEGER');
}

function defaultFor(key, role) {
  return !!DEFAULTS[key]?.[role];
}

/* --------------------------------------------------------- sync read path */
// hasPermission() in lib/auth/auth.js must stay synchronous (it's called
// without await from a handful of unrelated routes) — so the DB-backed
// matrix is loaded into this module-level cache ahead of time (see
// ensurePermissionCache, awaited once per request in api-guard.js) and
// checked here without touching the database.

let CACHE = null;

export async function ensurePermissionCache(db) {
  // A manager can change roles while another server worker is handling
  // cashier requests. Refresh the small matrix on each guarded request so
  // stale worker memory cannot keep access hidden (or granted) incorrectly.
  await ensurePermissionsSchema(db);
  const rows = await db.all(`SELECT role, permission_key, allowed FROM role_permissions`);
  const cache = {};
  for (const role of MANAGED_ROLES) cache[role] = {};
  for (const row of rows || []) {
    if (!cache[row.role]) cache[row.role] = {};
    cache[row.role][row.permission_key] = !!row.allowed;
  }
  CACHE = cache;
  return CACHE;
}

export function invalidatePermissionCache() {
  CACHE = null;
}

export function isPermissionAllowedSync(role, key) {
  if (role === 'admin') return true;
  const cached = CACHE?.[role]?.[key];
  if (cached != null) return cached;
  return defaultFor(key, role);
}

/* ------------------------------------------------------------- admin CRUD */

export async function listRolePermissions(db) {
  await ensurePermissionsSchema(db);
  const rows = await db.all(`SELECT role, permission_key, allowed FROM role_permissions`);
  const matrix = {};
  for (const role of MANAGED_ROLES) {
    matrix[role] = {};
    for (const { key } of PERMISSION_CATALOG) matrix[role][key] = defaultFor(key, role);
  }
  for (const row of rows || []) {
    if (matrix[row.role]) matrix[row.role][row.permission_key] = !!row.allowed;
  }
  return { catalog: PERMISSION_CATALOG, roles: MANAGED_ROLES, matrix };
}

export async function setRolePermissions(db, updates, actor) {
  await ensurePermissionsSchema(db);
  const clean = (updates || []).filter((u) => {
    if (!MANAGED_ROLES.includes(u?.role) || !CATALOG_KEYS.has(u?.key)) return false;
    const allowedRoles = CATALOG_BY_KEY.get(u.key)?.roles;
    return !allowedRoles || allowedRoles.includes(u.role);
  });
  if (!clean.length) fail('No valid permission changes supplied.');

  await db.transaction(async (tx) => {
    for (const { role, key, allowed } of clean) {
      const prev = await tx.get(`SELECT allowed FROM role_permissions WHERE role=? AND permission_key=?`, [role, key]);
      const nextValue = allowed ? 1 : 0;
      await tx.run(
        `INSERT INTO role_permissions (role, permission_key, allowed, updated_by, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (role, permission_key) DO UPDATE SET allowed = excluded.allowed, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [role, key, nextValue, actor?.id || null]
      );
      const previousValue = prev ? (prev.allowed ? 1 : 0) : (defaultFor(key, role) ? 1 : 0);
      if (previousValue !== nextValue) {
        await tx.run(
          `INSERT INTO permission_audit (role, permission_key, previous_value, new_value, actor_id, actor_name)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [role, key, previousValue, nextValue, actor?.id || null, actor?.full_name || actor?.username || null]
        );
      }
    }
  });

  invalidatePermissionCache();
  return listRolePermissions(db);
}

export async function permissionAuditHistory(db, { limit = 100 } = {}) {
  await ensurePermissionsSchema(db);
  return db.all(`SELECT * FROM permission_audit ORDER BY created_at DESC, id DESC LIMIT ${Math.min(500, Math.max(1, Number(limit) || 100))}`);
}
