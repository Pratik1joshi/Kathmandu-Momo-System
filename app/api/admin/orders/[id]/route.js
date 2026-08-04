import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { id } = await params;
    const db = Database.getInstance();
    
    // Get order details
    const order = await db.get(
      `
      SELECT o.*,
             (
               SELECT COALESCE(SUM(oi.subtotal), 0)
               FROM order_items oi
               WHERE oi.order_id = o.id
                 AND COALESCE(oi.status, '') NOT IN ('voided', 'cancelled')
             ) AS total_amount
      FROM orders o
      WHERE o.id = ?
    `,
      [id]
    );

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get order items
    const items = await db.all(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [id]);

    return NextResponse.json({ order, items });
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch order details');
  }
}
