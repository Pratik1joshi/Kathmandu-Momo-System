import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { checkRateLimit, clientIp } from '@/lib/rate-limit.js';
import { readCmsContent } from '@/lib/cms.js';
import {
  createOnlineOrderRequest,
  normalizeWhatsAppNumber,
  whatsappMessage,
} from '@/lib/online-orders.js';
import { logger } from '@/lib/logger.js';

export async function POST(request) {
  try {
    const limited = await checkRateLimit({
      key: `online-order:${clientIp(request)}`,
      limit: Number(process.env.RATE_LIMIT_PUBLIC_ORDERS || 12),
      windowSeconds: 60,
    });
    if (!limited.ok) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429 });
    }
    const body = await request.json();
    const db = Database.getInstance();
    const result = await createOnlineOrderRequest(db, body);
    let whatsappUrl = null;
    if (result.request.source === 'WHATSAPP') {
      const cms = await readCmsContent(db, { publishedOnly: true });
      const setting = await db.get(`SELECT setting_value FROM system_settings WHERE setting_key='restaurant_phone'`);
      const number = normalizeWhatsAppNumber(cms.whatsapp || cms.phone || setting?.setting_value);
      if (!number) {
        return NextResponse.json({
          error: 'WhatsApp ordering is not configured. Your request was saved; please call the restaurant with the reference.',
          reference: result.request.reference,
          lookup_token: result.request.lookup_token,
        }, { status: 503 });
      }
      whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(result.request, result.items))}`;
    }
    return NextResponse.json({
      success: true,
      duplicate: result.duplicate,
      reference: result.request.reference,
      lookup_token: result.request.lookup_token,
      status: result.request.status,
      payment_status: result.request.payment_status,
      total: result.request.total_amount,
      whatsapp_url: whatsappUrl,
      message: result.request.source === 'WHATSAPP'
        ? 'WhatsApp is ready. Send the prepared message; Kathmandu Momo still needs to confirm it.'
        : 'Your request was submitted. Kathmandu Momo still needs to confirm it.',
    }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if ((error.status || 500) >= 500) logger.error('online_order_submit_failed', { message: error.message });
    return NextResponse.json(
      { error: error.status ? error.message : 'We could not save the order request. Please try again.', code: error.code },
      { status: error.status || 500 }
    );
  }
}
