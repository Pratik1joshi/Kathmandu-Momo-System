-- Website + WhatsApp order requests.
-- Requests are intentionally separate from operational orders: a public submit
-- must not create a KOT, invoice, journal, payment, or permanent stock movement.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'STAFF';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS online_request_id BIGINT;

CREATE TABLE IF NOT EXISTS online_order_requests (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  lookup_token TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('WEBSITE', 'WHATSAPP')),
  fulfillment_method TEXT NOT NULL DEFAULT 'PICKUP' CHECK (fulfillment_method IN ('PICKUP', 'DINE_IN')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  phone_digits TEXT NOT NULL,
  notes TEXT,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  delivery_charge DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PENDING_VERIFICATION','PAID','PARTIALLY_REFUNDED','REFUNDED','FAILED')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','READY','COMPLETED','CANCELLED','REFUNDED')),
  order_id INTEGER UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  action_reason TEXT,
  accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP,
  ready_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS online_order_request_items (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES online_order_requests(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  variant_id INTEGER REFERENCES menu_item_variants(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  variant_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DOUBLE PRECISION NOT NULL CHECK (unit_price >= 0),
  subtotal DOUBLE PRECISION NOT NULL CHECK (subtotal >= 0),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS online_order_audit (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES online_order_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_online_request_one_active_order ON online_order_requests(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_online_request ON orders(online_request_id) WHERE online_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_online_request_queue ON online_order_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_request_source ON online_order_requests(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_request_phone ON online_order_requests(phone_digits, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_audit_request ON online_order_audit(request_id, created_at DESC);
