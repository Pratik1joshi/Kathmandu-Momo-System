import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';

export async function PUT(request, context) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const data = await request.json();
    const db = Database.getInstance();

    const price = data.price || data.base_price || 0;

    await db.run(`
      UPDATE menu_items 
      SET name = ?, category_id = ?, base_price = ?, 
          description = ?, image_url = ?, is_available = ?, is_vegetarian = ?,
          preparation_time = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.name,
      data.category_id || null,
      price,
      data.description || null,
      data.image_url ?? null,
      data.is_available ? 1 : 0,
      data.is_vegetarian ? 1 : 0,
      data.preparation_time || 15,
      id,
    ]);

    const product = await db.get(`
      SELECT 
        mi.*,
        mi.base_price as price,
        mc.name as category
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = ?
    `, [id]);

    return NextResponse.json({
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    return handleRouteError(error, 'Failed to update product');
  }
}

export async function DELETE(request, context) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const db = Database.getInstance();

    await db.run('DELETE FROM menu_items WHERE id = ?', [id]);

    return NextResponse.json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    return handleRouteError(error, 'Failed to delete product');
  }
}
