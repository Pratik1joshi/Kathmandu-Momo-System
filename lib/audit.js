import { ensureSqliteTable } from './db/ensure-sqlite-table.js';

export async function ensureAuditSchema(db) {
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    actor_id INTEGER,
    actor_role TEXT,
    before_data TEXT,
    after_data TEXT,
    reason TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

function json(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export async function writeAudit(db, {
  event_type,
  entity_type,
  entity_id = null,
  actor = null,
  before = null,
  after = null,
  reason = null,
  metadata = null,
}) {
  await ensureAuditSchema(db);
  await db.run(
    `INSERT INTO audit_log
      (event_type, entity_type, entity_id, actor_id, actor_role, before_data, after_data, reason, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [event_type, entity_type, entity_id == null ? null : String(entity_id), actor?.id || null,
      actor?.role || null, json(before), json(after), reason || null, json(metadata)]
  );
}
