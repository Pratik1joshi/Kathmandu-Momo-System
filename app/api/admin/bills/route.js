import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureReopenSchema } from '@/lib/bill-reopen.js';
import { ensureAuditSchema } from '@/lib/audit.js';

const TAB_SQL = {
  active: `b.status IN ('draft', 'active')`,
  pending: `b.status IN ('unpaid', 'partial', 'pending')`,
  completed: `b.status = 'paid'`,
  cancelled: `b.status IN ('cancelled', 'void', 'voided', 'refunded')`,
  all: '1=1',
};

export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const db = Database.getInstance();
    await ensureReopenSchema(db);
    await ensureAuditSchema(db);
    const params = new URL(request.url).searchParams;
    const id = Number(params.get('id'));
    if (id) return getBillDetail(db, id);

    const tab = TAB_SQL[params.get('tab')] ? params.get('tab') : 'all';
    const page = Math.max(Number(params.get('page')) || 1, 1);
    const pageSize = Math.min(Math.max(Number(params.get('page_size')) || 25, 10), 100);
    const values = [];
    const where = [TAB_SQL[tab]];
    const q = String(params.get('q') || '').trim().toLowerCase();
    if (q) {
      const term = `%${q}%`;
      where.push(`(lower(b.bill_number) LIKE ? OR lower(o.order_number) LIKE ?
        OR lower(COALESCE(o.customer_name, '')) LIKE ? OR COALESCE(o.customer_phone, '') LIKE ?
        OR lower(COALESCE(t.table_number, o.table_number, '')) LIKE ?)`);
      values.push(term, term, term, term, term);
    }
    const from = params.get('from');
    const to = params.get('to');
    if (from) { where.push('date(b.created_at) >= date(?)'); values.push(from); }
    if (to) { where.push('date(b.created_at) <= date(?)'); values.push(to); }
    if (params.get('channel')) { where.push('o.order_type = ?'); values.push(params.get('channel')); }
    if (params.get('reopened') === '1') where.push('COALESCE(b.reopen_count, 0) > 0');

    const whereSql = where.join(' AND ');
    const countRow = await db.get(`SELECT COUNT(*) AS total FROM bills b
      JOIN orders o ON o.id = b.order_id LEFT JOIN tables t ON t.id = o.table_id
      WHERE ${whereSql}`, values);
    const counts = await db.get(`SELECT
      SUM(CASE WHEN ${TAB_SQL.active} THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN ${TAB_SQL.pending} THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN ${TAB_SQL.completed} THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN ${TAB_SQL.cancelled} THEN 1 ELSE 0 END) AS cancelled,
      COUNT(*) AS all_count FROM bills b`);

    const bills = await db.all(
      `SELECT b.id, b.bill_number, b.order_id, b.status AS bill_status, b.grand_total,
        b.created_at, b.paid_at, b.reopened_at, COALESCE(b.reopen_count, 0) AS reopen_count,
        b.parent_bill_id, o.order_number, o.order_type, o.status AS order_status,
        o.customer_name, o.customer_phone, o.updated_at,
        COALESCE(t.table_number, o.table_number) AS table_number, t.floor AS floor_name,
        waiter.full_name AS waiter_name, cashier.full_name AS cashier_name,
        COALESCE((SELECT SUM(bp.amount) FROM bill_payments bp WHERE bp.bill_id = b.id), 0) AS paid_amount,
        (SELECT COUNT(*) FROM kots k WHERE k.order_id = o.id) AS kot_count,
        (SELECT COUNT(*) FROM kots k WHERE k.order_id = o.id AND k.status NOT IN ('completed', 'cancelled')) AS open_kot_count
       FROM bills b JOIN orders o ON o.id = b.order_id
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users waiter ON waiter.id = o.waiter_id LEFT JOIN users cashier ON cashier.id = b.cashier_id
       WHERE ${whereSql} ORDER BY COALESCE(o.updated_at, b.created_at) DESC, b.id DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, (page - 1) * pageSize]
    );

    return NextResponse.json({
      bills,
      counts: {
        active: Number(counts?.active || 0), pending: Number(counts?.pending || 0),
        completed: Number(counts?.completed || 0), cancelled: Number(counts?.cancelled || 0),
        all: Number(counts?.all_count || 0),
      },
      pagination: { page, page_size: pageSize, total: Number(countRow?.total || 0), pages: Math.max(Math.ceil(Number(countRow?.total || 0) / pageSize), 1) },
    });
  } catch (error) {
    return handleRouteError(error, 'Could not load bills.');
  }
}

async function getBillDetail(db, id) {
  const bill = await db.get(
    `SELECT b.*, o.order_number, o.order_type, o.status AS order_status, o.customer_name,
      o.customer_phone, o.notes AS order_notes, o.reopened_from_bill_id,
      COALESCE(t.table_number, o.table_number) AS table_number, t.floor AS floor_name,
      waiter.full_name AS waiter_name, cashier.full_name AS cashier_name
     FROM bills b JOIN orders o ON o.id = b.order_id
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users waiter ON waiter.id = o.waiter_id LEFT JOIN users cashier ON cashier.id = b.cashier_id
     WHERE b.id = ?`,
    [id]
  );
  if (!bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
  const [items, payments, corrections, revisions, kots, audit] = await Promise.all([
    db.all(`SELECT id, item_name, quantity, price, subtotal, special_instructions, status
      FROM order_items WHERE order_id = ? ORDER BY id`, [bill.order_id]),
    db.all(`SELECT id, amount, payment_method, reference_number, created_at
      FROM bill_payments WHERE bill_id = ? ORDER BY created_at, id`, [id]),
    db.all(`SELECT * FROM bill_corrections WHERE bill_id = ? ORDER BY created_at DESC, id DESC`, [id]),
    db.all(`SELECT o.id AS order_id, o.order_number, o.status AS order_status,
      child.id AS bill_id, child.bill_number, child.status AS bill_status, child.grand_total
      FROM orders o LEFT JOIN bills child ON child.order_id = o.id
      WHERE o.reopened_from_bill_id = ? ORDER BY o.id DESC`, [id]),
    db.all(`SELECT id, kot_number, station, status, printed_at, started_at, completed_at
      FROM kots WHERE order_id = ? ORDER BY id`, [bill.order_id]),
    db.all(`SELECT event_type, actor_id, actor_role, reason, metadata, created_at
      FROM audit_log WHERE entity_type = 'bill' AND entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`, [String(id)]),
  ]);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return NextResponse.json({ bill: { ...bill, items, payments, corrections, revisions, kots, audit, paid_amount: paid, balance_due: Math.max(Number(bill.grand_total || 0) - paid, 0) } });
}
