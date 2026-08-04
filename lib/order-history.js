/**
 * Order history search for the waiter (and cashier) history screens. Returns
 * orders joined with their paid bill, filterable by scope and searchable by
 * table / bill no. / order no. / customer. A row is `can_reopen` when it has a
 * paid bill (feeds the reopen flow) and `is_active` when still open.
 */

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * scope: 'today' | 'active' | 'completed' | 'all'
 * mine + waiter_id restricts to one waiter's orders.
 */
export async function searchOrderHistory(db, {
  q = '', scope = 'today', waiter_id = null, mine = false, date = null, limit = 60,
} = {}) {
  const where = [];
  const params = [];

  if (mine && waiter_id) {
    where.push('o.waiter_id = ?');
    params.push(waiter_id);
  }

  if (scope === 'active') {
    where.push(`o.status NOT IN ('completed', 'cancelled')`);
  } else if (scope === 'completed') {
    where.push(`o.status = 'completed'`);
  } else if (scope === 'today') {
    where.push('o.created_at >= ?');
    params.push(isoDaysAgo(1)); // last 24h; UI labels it "today"
  } else {
    // 'all' — keep it bounded so history never scans the whole table.
    where.push('o.created_at >= ?');
    params.push(isoDaysAgo(30));
  }

  if (date) {
    const day = String(date).slice(0, 10);
    const next = new Date(`${day}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    where.push('o.created_at >= ? AND o.created_at < ?');
    params.push(`${day} 00:00:00`, `${next.toISOString().slice(0, 10)} 00:00:00`);
  }

  const term = String(q || '').trim();
  if (term) {
    const like = `%${term.toLowerCase()}%`;
    where.push(`(
      lower(COALESCE(o.order_number, '')) LIKE ?
      OR lower(COALESCE(b.bill_number, '')) LIKE ?
      OR lower(COALESCE(t.table_number, o.table_number, '')) LIKE ?
      OR lower(COALESCE(o.customer_name, '')) LIKE ?
      OR COALESCE(o.customer_phone, '') LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }

  params.push(Number(limit) || 60);

  const rows = await db.all(
    `SELECT o.id AS order_id, o.order_number, o.status, o.order_type, o.created_at, o.updated_at,
            o.customer_name, o.customer_phone, o.waiter_id,
            COALESCE(t.table_number, o.table_number) AS table_number,
            u.full_name AS waiter_name,
            (SELECT COALESCE(SUM(oi.subtotal), 0) FROM order_items oi
             WHERE oi.order_id = o.id AND COALESCE(oi.status, '') NOT IN ('voided', 'cancelled')) AS total_amount,
            b.id AS bill_id, b.bill_number, b.grand_total, b.status AS bill_status, b.paid_at
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     LEFT JOIN users u ON o.waiter_id = u.id
     LEFT JOIN bills b ON b.order_id = o.id AND b.status = 'paid'
     WHERE ${where.join(' AND ')}
     ORDER BY o.id DESC
     LIMIT ?`,
    params
  );

  return rows.map((r) => ({
    ...r,
    is_active: !['completed', 'cancelled'].includes(String(r.status)),
    can_reopen: !!r.bill_id, // has a paid bill
    amount: Number(r.grand_total ?? r.total_amount ?? 0),
  }));
}
