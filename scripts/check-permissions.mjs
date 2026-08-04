/**
 * Self-check for the permission service (lib/permissions.js).
 * Verifies defaults, admin-always-full, override persistence, immediate effect,
 * and the ensureCan server guard.
 *
 *   node scripts/check-permissions.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PosDatabase } from '../lib/db/index.js';
import {
  getRolePermissions, effectivePermissions, ensureCan, saveRolePermissions,
} from '../lib/permissions.js';

const tmp = path.join(os.tmpdir(), `perms-check-${Date.now()}.db`);

async function main() {
  const db = new PosDatabase(tmp);

  // defaults
  const def = await getRolePermissions(db);
  assert.equal(def.waiter.reopen_bills, false, 'waiter cannot reopen by default');
  assert.equal(def.cashier.reopen_bills, true, 'cashier can reopen by default');
  assert.equal(def.cashier.complete_payments, true, 'cashier can complete payments');
  assert.equal(def.waiter.transfer_tables, true, 'waiter can transfer by default');
  assert.equal(def.admin && Object.values(def.admin).every(Boolean), true, 'admin is full');

  // admin always full regardless of stored config
  const adminMap = await effectivePermissions(db, 'admin');
  assert.equal(adminMap.void_bills, true, 'admin has void even if unset');

  // ensureCan guards
  await assert.rejects(() => ensureCan(db, { role: 'waiter' }, 'reopen_bills'), /permission/, 'waiter blocked from reopen');
  await ensureCan(db, { role: 'cashier' }, 'reopen_bills'); // allowed → no throw
  await ensureCan(db, { role: 'admin' }, 'void_bills'); // admin always ok

  // admin grants waiter reopen → takes effect immediately (read fresh from DB)
  await saveRolePermissions(db, { waiter: { reopen_bills: true } });
  const after = await effectivePermissions(db, 'waiter');
  assert.equal(after.reopen_bills, true, 'override applied');
  assert.equal(after.transfer_tables, true, 'unrelated default preserved');
  await ensureCan(db, { role: 'waiter' }, 'reopen_bills'); // now allowed

  // admin revokes cashier merge
  await saveRolePermissions(db, { cashier: { merge_tables: false } });
  const cash = await effectivePermissions(db, 'cashier');
  assert.equal(cash.merge_tables, false, 'revoke applied');
  assert.equal(cash.complete_payments, true, 'other cashier perms intact');
  await assert.rejects(() => ensureCan(db, { role: 'cashier' }, 'merge_tables'), /permission/);

  // admin cannot be downgraded via save (not a configurable role)
  await saveRolePermissions(db, { admin: { void_bills: false } });
  assert.equal((await effectivePermissions(db, 'admin')).void_bills, true, 'admin stays full');

  db.close();
  console.log('✓ permissions self-check passed');
}

main()
  .catch((e) => { console.error('✗ permissions self-check FAILED'); console.error(e); process.exitCode = 1; })
  .finally(() => { for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) { try { fs.unlinkSync(f); } catch {} } });
