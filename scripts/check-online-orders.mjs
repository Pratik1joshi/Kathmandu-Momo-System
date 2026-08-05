/** Core invariants for public Website/WhatsApp requests on isolated SQLite. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PosDatabase } from '../lib/db/index.js';
import {
  acceptOnlineOrder,
  createOnlineOrderRequest,
  normalizeWhatsAppNumber,
  whatsappMessage,
} from '../lib/online-orders.js';

const tmp = path.join(os.tmpdir(), `online-order-check-${Date.now()}.db`);

async function main() {
  const db = new PosDatabase(tmp);
  try {
    const menu = await db.all(`SELECT id, name FROM menu_items WHERE is_available=1 ORDER BY id LIMIT 2`);
    assert.ok(menu.length, 'seed menu has an available item');
    const key = `test-${Date.now()}-website-request`;
    const payload = {
      source: 'WEBSITE', idempotency_key: key, customer_name: 'QA Customer',
      customer_phone: '9849216081', fulfillment_method: 'PICKUP',
      items: [{ menu_item_id: menu[0].id, quantity: 2 }],
    };
    const beforeOrders = Number((await db.get(`SELECT COUNT(*) c FROM orders`)).c);
    const beforeKots = Number((await db.get(`SELECT COUNT(*) c FROM kots`)).c);
    const submitted = await createOnlineOrderRequest(db, payload);
    assert.equal(submitted.request.status, 'PENDING');
    assert.equal(Number((await db.get(`SELECT COUNT(*) c FROM orders`)).c), beforeOrders, 'submission creates no operational order');
    assert.equal(Number((await db.get(`SELECT COUNT(*) c FROM kots`)).c), beforeKots, 'submission creates no KOT');
    const duplicate = await createOnlineOrderRequest(db, payload);
    assert.equal(duplicate.request.id, submitted.request.id, 'idempotent retry returns stable request');
    const accepted = await acceptOnlineOrder(db, submitted.request.id, { id: 1 });
    assert.equal(accepted.status, 'ACCEPTED');
    assert.ok(accepted.order_id, 'acceptance creates operational order');
    assert.equal(Number((await db.get(`SELECT COUNT(*) c FROM kots WHERE order_id=?`, [accepted.order_id])).c), 1, 'acceptance creates exactly one KOT');
    await acceptOnlineOrder(db, submitted.request.id, { id: 1 });
    assert.equal(Number((await db.get(`SELECT COUNT(*) c FROM kots WHERE order_id=?`, [accepted.order_id])).c), 1, 'repeated acceptance does not duplicate KOT');
    assert.equal(normalizeWhatsAppNumber('984-921-6081'), '9779849216081');
    const message = whatsappMessage(submitted.request, submitted.items);
    assert.match(message, new RegExp(submitted.request.reference));
    assert.match(message, /Estimated total/);
    console.log('Online order checks passed: pending isolation, stable idempotency, one order/KOT, WhatsApp normalization.');
  } finally {
    db.close();
    fs.rmSync(tmp, { force: true });
    for (const suffix of ['-wal', '-shm']) fs.rmSync(`${tmp}${suffix}`, { force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
