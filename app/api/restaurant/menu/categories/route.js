import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';

// GET - List all categories
export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = Database.getInstance();
    
    // Get categories from menu_categories table
    const categories = await db.all(`
      SELECT id, name, display_order, icon, is_active, created_at
      FROM menu_categories
      WHERE is_active = 1
      ORDER BY display_order ASC, name ASC
    `);

    return NextResponse.json({ categories });
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch categories');
  }
}

// POST - Create new category
export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { name, icon, display_order } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const db = Database.getInstance();

    // Check if category name already exists
    const existing = await db.get(
      'SELECT id FROM menu_categories WHERE name = ? AND is_active = 1',
      [name.trim()]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Category name already exists' },
        { status: 400 }
      );
    }

    // Get max display order if not provided
    let order = display_order;
    if (!order) {
      const maxOrder = await db.get(
        'SELECT MAX(display_order) as max_order FROM menu_categories'
      );
      order = (maxOrder?.max_order || 0) + 1;
    }

    // Insert new category
    const result = await db.run(`
      INSERT INTO menu_categories (name, icon, display_order, is_active)
      VALUES (?, ?, ?, 1)
    `, [name.trim(), icon || null, order]);

    const category = await db.get(
      'SELECT * FROM menu_categories WHERE id = ?',
      [result.lastInsertRowid]
    );

    return NextResponse.json({
      message: 'Category created successfully',
      category
    }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Failed to create category');
  }
}

// PUT - Update category
export async function PUT(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id, name, icon, display_order } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const db = Database.getInstance();

    // Check if category exists
    const existing = await db.get(
      'SELECT id FROM menu_categories WHERE id = ?',
      [id]
    );

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if new name conflicts with another category
    const conflict = await db.get(
      'SELECT id FROM menu_categories WHERE name = ? AND id != ? AND is_active = 1',
      [name.trim(), id]
    );

    if (conflict) {
      return NextResponse.json(
        { error: 'Category name already exists' },
        { status: 400 }
      );
    }

    // Update category
    await db.run(`
      UPDATE menu_categories
      SET name = ?, icon = ?, display_order = ?
      WHERE id = ?
    `, [name.trim(), icon || null, display_order || 0, id]);

    const category = await db.get(
      'SELECT * FROM menu_categories WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    return handleRouteError(error, 'Failed to update category');
  }
}

// DELETE - Delete category
export async function DELETE(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const db = Database.getInstance();

    // Check if category has any menu items
    const itemCount = await db.get(
      'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
      [id]
    );

    if (itemCount && itemCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. ${itemCount.count} menu items are using this category.` },
        { status: 400 }
      );
    }

    // Soft delete - mark as inactive
    await db.run(
      'UPDATE menu_categories SET is_active = 0 WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      message: 'Category deleted successfully'
    });
  } catch (error) {
    return handleRouteError(error, 'Failed to delete category');
  }
}
