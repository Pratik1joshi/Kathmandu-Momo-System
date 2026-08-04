-- 025: table operations audit — transfer an order to another table, and merge
-- two occupied tables' orders into one. Both are pre-payment floor moves; every
-- action is logged in table_ops_log (who / why / when / from / to). Nothing is
-- deleted: a merged source order is cancelled and points at the survivor.

CREATE TABLE IF NOT EXISTS table_ops_log (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('transfer', 'merge')),
  order_id INTEGER,
  merged_order_id INTEGER,
  from_table_id INTEGER,
  to_table_id INTEGER,
  reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_table_ops_order ON table_ops_log(order_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS merged_into_order_id INTEGER;
