-- 027: Website CMS/media, general audit trail, and linked supplemental bills.

CREATE TABLE IF NOT EXISTS cms_content (
  content_key TEXT PRIMARY KEY,
  content_value TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_media (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  original_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  before_data TEXT,
  after_data TEXT,
  reason TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_media_active ON cms_media(is_archived, created_at DESC);

ALTER TABLE bills ADD COLUMN IF NOT EXISTS parent_bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL;
ALTER TABLE bill_corrections ADD COLUMN IF NOT EXISTS related_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_active_revision
  ON orders(reopened_from_bill_id)
  WHERE reopened_from_bill_id IS NOT NULL AND status NOT IN ('completed', 'cancelled');

