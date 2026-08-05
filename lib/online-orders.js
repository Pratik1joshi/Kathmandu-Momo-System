import crypto from 'crypto';
import { ensureSqliteTable } from './db/ensure-sqlite-table.js';
import { deductStockForItems } from './stock.js';

export const ONLINE_STATUSES = ['PENDING', 'ACCEPTED', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
export const PAYMENT_STATUSES = ['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED'];

const clean = (value, max = 200) => String(value || '').trim().slice(0, max);
export const phoneDigits = (value) => String(value || '').replace(/\D/g, '');

function publicError(message, status = 400, code = 'invalid_request') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function ensureOnlineOrderSchema(db) {
  if (db.driver !== 'sqlite') return;
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS online_order_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL UNIQUE,
    lookup_token TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL, fulfillment_method TEXT NOT NULL DEFAULT 'PICKUP',
    customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, phone_digits TEXT NOT NULL,
    notes TEXT, subtotal REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0, delivery_charge REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0, payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID', status TEXT NOT NULL DEFAULT 'PENDING',
    order_id INTEGER UNIQUE, action_reason TEXT, accepted_by INTEGER, accepted_at DATETIME,
    ready_at DATETIME, completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS online_order_request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL, variant_id INTEGER, item_name TEXT NOT NULL,
    variant_name TEXT, quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
    subtotal REAL NOT NULL, notes TEXT, FOREIGN KEY(request_id) REFERENCES online_order_requests(id) ON DELETE CASCADE
  )`);
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS online_order_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, action TEXT NOT NULL,
    from_status TEXT, to_status TEXT, reason TEXT, actor_id INTEGER, metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(request_id) REFERENCES online_order_requests(id) ON DELETE CASCADE
  )`);
  const columns = await db.all(`PRAGMA table_info(orders)`);
  for (const [name, ddl] of [
    ['order_source', "TEXT NOT NULL DEFAULT 'STAFF'"],
    ['payment_status', "TEXT NOT NULL DEFAULT 'UNPAID'"],
    ['online_request_id', 'INTEGER'],
  ]) {
    if (!columns.some((c) => c.name === name)) await db.run(`ALTER TABLE orders ADD COLUMN ${name} ${ddl}`);
  }
}

async function menuLine(db, input) {
  const id = Number(input.menu_item_id ?? input.id);
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 50) {
    throw publicError('Please check the item quantity.');
  }
  const item = await db.get(
    `SELECT id, name, base_price, is_available FROM menu_items WHERE id = ?`, [id]
  );
  if (!item || Number(item.is_available) !== 1) throw publicError('One of these items is no longer available.', 409, 'item_unavailable');
  let variant = null;
  if (input.variant_id) {
    variant = await db.get(
      `SELECT id, variant_name, price_modifier FROM menu_item_variants WHERE id = ? AND menu_item_id = ?`,
      [Number(input.variant_id), id]
    );
    if (!variant) throw publicError('The selected item option is no longer available.', 409, 'variant_unavailable');
  }
  const unitPrice = Number(item.base_price) + Number(variant?.price_modifier || 0);
  return {
    menu_item_id: id,
    variant_id: variant?.id || null,
    item_name: item.name,
    variant_name: variant?.variant_name || null,
    quantity: qty,
    unit_price: unitPrice,
    subtotal: unitPrice * qty,
    notes: clean(input.notes || input.special_instructions, 200) || null,
  };
}

async function audit(db, requestId, action, fromStatus, toStatus, actorId, reason = null, metadata = null) {
  await db.run(
    `INSERT INTO online_order_audit
      (request_id, action, from_status, to_status, reason, actor_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [requestId, action, fromStatus, toStatus, reason, actorId || null, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function createOnlineOrderRequest(db, body = {}) {
  await ensureOnlineOrderSchema(db);
  const source = clean(body.source, 20).toUpperCase();
  if (!['WEBSITE', 'WHATSAPP'].includes(source)) throw publicError('Choose website or WhatsApp ordering.');
  const fulfillment = clean(body.fulfillment_method || 'PICKUP', 20).toUpperCase();
  if (!['PICKUP', 'DINE_IN'].includes(fulfillment)) throw publicError('That fulfillment method is not enabled.');
  const name = clean(body.customer_name, 80);
  const digits = phoneDigits(body.customer_phone);
  if (name.length < 2) throw publicError('Please enter your name.');
  if (digits.length < 10 || digits.length > 15) throw publicError('Please enter a valid phone number.');
  const key = clean(body.idempotency_key, 120);
  if (key.length < 12) throw publicError('Please refresh checkout and try again.', 400, 'idempotency_required');
  const existing = await db.get(`SELECT * FROM online_order_requests WHERE idempotency_key = ?`, [key]);
  if (existing) return { request: existing, items: await requestItems(db, existing.id), duplicate: true };
  const raw = Array.isArray(body.items) ? body.items : [];
  if (!raw.length || raw.length > 40) throw publicError('Your cart is empty or too large.');
  const items = [];
  for (const input of raw) items.push(await menuLine(db, input));
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  // Tax, discount and delivery are intentionally zero unless a verified pricing
  // rule is added to settings. The server remains the only totals authority.
  const reference = `${source === 'WHATSAPP' ? 'WA' : 'WEB'}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const lookupToken = crypto.randomBytes(24).toString('base64url');
  try {
    return await db.transaction(async (tx) => {
    const result = await tx.run(
      `INSERT INTO online_order_requests
       (reference, lookup_token, idempotency_key, source, fulfillment_method,
        customer_name, customer_phone, phone_digits, notes, subtotal,
        discount_amount, tax_amount, delivery_charge, total_amount, payment_method,
        payment_status, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'UNPAID', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [reference, lookupToken, key, source, fulfillment, name, clean(body.customer_phone, 30), digits,
        clean(body.notes, 500) || null, subtotal, subtotal, clean(body.payment_method, 40) || null]
    );
    const requestId = result.lastInsertRowid;
    for (const item of items) {
      await tx.run(
        `INSERT INTO online_order_request_items
         (request_id, menu_item_id, variant_id, item_name, variant_name, quantity, unit_price, subtotal, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [requestId, item.menu_item_id, item.variant_id, item.item_name, item.variant_name,
          item.quantity, item.unit_price, item.subtotal, item.notes]
      );
    }
    await audit(tx, requestId, 'SUBMITTED', null, 'PENDING', null, null, { source });
    const request = await tx.get(`SELECT * FROM online_order_requests WHERE id = ?`, [requestId]);
      return { request, items, duplicate: false };
    });
  } catch (error) {
    if (/unique|duplicate/i.test(String(error?.message || ''))) {
      const raced = await db.get(`SELECT * FROM online_order_requests WHERE idempotency_key = ?`, [key]);
      if (raced) return { request: raced, items: await requestItems(db, raced.id), duplicate: true };
    }
    throw error;
  }
}

export async function requestItems(db, requestId) {
  return db.all(`SELECT * FROM online_order_request_items WHERE request_id = ? ORDER BY id`, [requestId]);
}

export async function getOnlineOrderByToken(db, token) {
  await ensureOnlineOrderSchema(db);
  const request = await db.get(
    `SELECT reference, source, fulfillment_method, customer_name, subtotal, discount_amount,
            tax_amount, delivery_charge, total_amount, payment_status, status, created_at, updated_at
     FROM online_order_requests WHERE lookup_token = ?`, [token]
  );
  if (!request) return null;
  return { ...request, items: await requestItems(db, (await db.get(`SELECT id FROM online_order_requests WHERE lookup_token = ?`, [token])).id) };
}

export async function listOnlineOrders(db, { status = 'ALL', source = 'ALL' } = {}) {
  await ensureOnlineOrderSchema(db);
  const conditions = [];
  const params = [];
  if (status !== 'ALL') { conditions.push('r.status = ?'); params.push(status); }
  if (source !== 'ALL') { conditions.push('r.source = ?'); params.push(source); }
  const rows = await db.all(
    `SELECT r.*, o.order_number,
            (SELECT COUNT(*) FROM online_order_request_items i WHERE i.request_id = r.id) AS item_count
     FROM online_order_requests r LEFT JOIN orders o ON o.id = r.order_id
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 250`, params
  );
  const counts = await db.get(
    `SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='ACCEPTED' THEN 1 ELSE 0 END) AS accepted,
      SUM(CASE WHEN status='READY' THEN 1 ELSE 0 END) AS ready
     FROM online_order_requests`
  );
  return { rows, counts };
}

export async function onlineOrderDetail(db, id) {
  await ensureOnlineOrderSchema(db);
  const request = await db.get(`SELECT * FROM online_order_requests WHERE id = ?`, [id]);
  if (!request) return null;
  return {
    ...request,
    items: await requestItems(db, id),
    audit: await db.all(`SELECT * FROM online_order_audit WHERE request_id = ? ORDER BY id DESC`, [id]),
  };
}

export async function acceptOnlineOrder(db, id, actor) {
  await ensureOnlineOrderSchema(db);
  return db.transaction(async (tx) => {
    const suffix = db.driver === 'postgres' ? ' FOR UPDATE' : '';
    const request = await tx.get(`SELECT * FROM online_order_requests WHERE id = ?${suffix}`, [id]);
    if (!request) throw publicError('Order request not found.', 404, 'not_found');
    if (request.order_id) return onlineOrderDetail(tx, id);
    if (request.status !== 'PENDING') throw publicError('Only pending requests can be accepted.', 409, 'invalid_transition');
    const snapshots = await requestItems(tx, id);
    const current = [];
    for (const line of snapshots) {
      const live = await menuLine(tx, line);
      if (Number(live.unit_price) !== Number(line.unit_price)) {
        throw publicError(`${line.item_name} has a new price. Ask the customer to review the order.`, 409, 'price_changed');
      }
      current.push(live);
    }
    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const orderResult = await tx.run(
      `INSERT INTO orders
       (order_number, order_type, status, customer_name, customer_phone, notes,
        order_source, payment_status, online_request_id, created_at, updated_at)
       VALUES (?, 'takeaway', 'confirmed', ?, ?, ?, ?, 'UNPAID', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [orderNumber, request.customer_name, request.customer_phone,
        `Online request ${request.reference}${request.notes ? `\n${request.notes}` : ''}`, request.source, id]
    );
    const orderId = orderResult.lastInsertRowid;
    const kotLines = [];
    for (const line of current) {
      const itemResult = await tx.run(
        `INSERT INTO order_items
         (order_id, item_id, menu_item_id, item_name, quantity, price, subtotal, special_instructions, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [orderId, line.menu_item_id, line.menu_item_id, line.item_name, line.quantity,
          line.unit_price, line.subtotal, line.notes]
      );
      kotLines.push({ ...line, order_item_id: itemResult.lastInsertRowid });
    }
    const stock = await deductStockForItems(tx, current, { orderId, performedBy: actor.id });
    const kotResult = await tx.run(
      `INSERT INTO kots (order_id, station, status, prepared_by, printed_at)
       VALUES (?, 'main', 'pending', NULL, CURRENT_TIMESTAMP)`, [orderId]
    );
    for (const line of kotLines) {
      await tx.run(
        `INSERT INTO kot_items (kot_id, order_item_id, menu_item_id, quantity, special_instructions, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [kotResult.lastInsertRowid, line.order_item_id, line.menu_item_id, line.quantity, line.notes]
      );
    }
    await tx.run(
      `UPDATE online_order_requests SET status='ACCEPTED', order_id=?, accepted_by=?,
       accepted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'`,
      [orderId, actor.id, id]
    );
    await audit(tx, id, 'ACCEPTED', 'PENDING', 'ACCEPTED', actor.id, null,
      { order_id: orderId, kot_id: kotResult.lastInsertRowid, stock_warnings: stock.warnings || [] });
    return onlineOrderDetail(tx, id);
  });
}

export async function transitionOnlineOrder(db, id, action, actor, reason = '') {
  await ensureOnlineOrderSchema(db);
  const map = {
    reject: { from: ['PENDING'], to: 'CANCELLED', orderStatus: null, needsReason: true },
    cancel: { from: ['ACCEPTED', 'READY'], to: 'CANCELLED', orderStatus: 'cancelled', needsReason: true },
    ready: { from: ['ACCEPTED'], to: 'READY', orderStatus: 'ready' },
  };
  const rule = map[action];
  if (!rule) throw publicError('Unsupported action.');
  if (rule.needsReason && clean(reason, 300).length < 3) throw publicError('A reason is required.');
  return db.transaction(async (tx) => {
    const request = await tx.get(`SELECT * FROM online_order_requests WHERE id = ?`, [id]);
    if (!request) throw publicError('Order request not found.', 404, 'not_found');
    if (!rule.from.includes(request.status)) throw publicError('This action is no longer available.', 409, 'invalid_transition');
    if (rule.orderStatus && request.order_id) {
      await tx.run(`UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [rule.orderStatus, request.order_id]);
      if (action === 'ready') await tx.run(`UPDATE kots SET status='ready', completed_at=CURRENT_TIMESTAMP WHERE order_id=?`, [request.order_id]);
    }
    await tx.run(
      `UPDATE online_order_requests SET status=?, action_reason=?,
       ready_at=CASE WHEN ?='READY' THEN CURRENT_TIMESTAMP ELSE ready_at END,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [rule.to, clean(reason, 300) || null, rule.to, id]
    );
    await audit(tx, id, action.toUpperCase(), request.status, rule.to, actor.id, clean(reason, 300) || null);
    return onlineOrderDetail(tx, id);
  });
}

export function normalizeWhatsAppNumber(value) {
  let digits = phoneDigits(value);
  if (digits.startsWith('0') && digits.length === 10) digits = `977${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) digits = `977${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function whatsappMessage(request, items) {
  const lines = items.map((item) =>
    `${item.quantity} x ${item.item_name}${item.variant_name ? ` (${item.variant_name})` : ''}${item.notes ? ` — ${item.notes}` : ''}`
  );
  return [
    'Kathmandu Momo order request',
    `Reference: ${request.reference}`,
    `Name: ${request.customer_name}`,
    `Phone: ${request.customer_phone}`,
    `Fulfillment: ${request.fulfillment_method}`,
    '', ...lines, '', `Estimated total: Rs ${Number(request.total_amount).toFixed(2)}`,
    request.notes ? `Order notes: ${request.notes}` : null,
    'Please confirm availability and final total.',
  ].filter(Boolean).join('\n');
}
