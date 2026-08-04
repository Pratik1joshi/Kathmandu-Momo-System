import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;

    const db = Database.getInstance();

    const products = await db.all(`
      SELECT 
        mi.*,
        mi.base_price as price,
        mc.name as category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      ORDER BY mi.name
    `);

    return NextResponse.json({ products });
  } catch (error) {
    return handleRouteError(error, 'Could not load the menu. Please try again.');
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const data = await request.json();
    const db = Database.getInstance();

    const price = data.price || data.base_price || 0;

    const result = await db.run(`
      INSERT INTO menu_items (
        name, category_id, base_price, description, image_url,
        is_available, is_vegetarian, preparation_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name,
      data.category_id || 1,
      price,
      data.description || null,
      data.image_url || null,
      data.is_available ? 1 : 0,
      data.is_vegetarian ? 1 : 0,
      data.preparation_time || 15,
    ]);

    const product = await db.get(`
      SELECT *
      FROM menu_items
      WHERE id = ?
    `, [result.lastInsertRowid]);

    return NextResponse.json({
      message: 'Product created successfully',
      product,
    }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to create product');
  }
}
