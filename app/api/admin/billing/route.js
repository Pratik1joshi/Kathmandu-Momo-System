import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { deductStockForItems, autoLinkBeverageStock } from '@/lib/stock.js';
import { resolveCustomerForSale } from '@/lib/customers.js';
import { calculateBillTotals, parseSettingsRates } from '@/lib/billing-totals.js';
import { requireAuth } from '@/lib/api-guard.js';

async function loadSettingsRates(db) {
  const rows = await db.all('SELECT setting_key, setting_value FROM system_settings');
  const settings = {};
  for (const row of rows || []) {
    settings[row.setting_key] = row.setting_value;
  }
  return parseSettingsRates(settings);
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin', 'cashier'] });
    if (auth.error) return auth.error;

    const data = await request.json();
    const db = Database.getInstance();

    if (!data.items?.length) {
      return NextResponse.json(
        { error: 'Please add at least one item to the bill.', code: 'empty_cart' },
        { status: 400 }
      );
    }

    await autoLinkBeverageStock(db);

    const { vatPercent, servicePercent } = await loadSettingsRates(db);
    const itemsSubtotal = (data.items || []).reduce((sum, item) => {
      const price = Number(item.price || 0);
      const quantity = Number(item.quantity || 1);
      return sum + Number(item.subtotal ?? price * quantity);
    }, 0);
    const discountAmount = Number(data.discount ?? 0);
    const discountPercent = Number(data.discount_percent ?? 0);
    const totals = calculateBillTotals(itemsSubtotal || Number(data.subtotal || 0), {
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      discountPercent: discountAmount > 0 ? undefined : discountPercent,
      vatPercent,
      servicePercent,
    });

    const result = await db.transaction(async () => {
      let customerInfo;
      try {
        customerInfo = await resolveCustomerForSale(db, {
          mode: data.customer_mode || (data.customer_phone ? 'customer' : 'walkin'),
          phone: data.customer_phone,
          name: data.customer_name,
          address: data.customer_address,
          amount: totals.total,
          recordSale: true,
        });
      } catch (e) {
        const err = new Error(e.message || 'Please check customer details.');
        err.code = 'customer_invalid';
        throw err;
      }

      const orderNumber = data.order_number || `ORD-${Date.now()}`;
      const billNumber = data.bill_number || `BILL-${Date.now()}`;

      const orderResult = await db.run(`
        INSERT INTO orders (
          order_number, table_id, table_number, order_type, status,
          waiter_id, customer_name, customer_phone, notes, created_at, updated_at
        ) VALUES (?, NULL, NULL, ?, 'completed', NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        orderNumber,
        data.order_type || 'takeaway',
        customerInfo.customer_name,
        customerInfo.customer_phone,
        data.notes || 'POS walk-in sale',
      ]);

      const orderId = orderResult.lastInsertRowid;

      for (const item of data.items) {
        const name = item.name || item.item_name || 'Custom item';
        const price = Number(item.price || 0);
        const quantity = Number(item.quantity || 1);
        const subtotal = Number(item.subtotal ?? price * quantity);
        const menuId = item.menu_item_id || item.id || null;

        await db.run(`
          INSERT INTO order_items (
            order_id, item_id, menu_item_id, item_name,
            quantity, price, subtotal, special_instructions, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'served', CURRENT_TIMESTAMP)
        `, [
          orderId,
          menuId,
          menuId,
          name,
          quantity,
          price,
          subtotal,
          item.special_instructions || (item.is_custom ? 'Custom item' : null),
        ]);
      }

      const tax = totals.tax;
      const billResult = await db.run(`
        INSERT INTO bills (
          bill_number, order_id, subtotal, tax, vat_amount, service_charge,
          discount_amount, grand_total, status, created_at, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        billNumber,
        orderId,
        totals.subtotal,
        tax,
        tax,
        totals.serviceCharge,
        totals.discount,
        totals.total,
      ]);

      const billId = billResult.lastInsertRowid;

      await db.run(`
        INSERT INTO bill_payments (bill_id, amount, payment_method, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        billId,
        Number(data.amount_paid ?? totals.total),
        data.payment_method === 'online' ? 'qr' : (data.payment_method || 'cash'),
      ]);

      const stock = await deductStockForItems(db, data.items, {
        orderId,
        performedBy: auth.user?.id || null,
      });

      return {
        orderId,
        billId,
        order_number: orderNumber,
        bill_number: billNumber,
        customer: customerInfo,
        stock,
        totals: {
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          tax_percent: totals.taxPercent,
          service_charge: totals.serviceCharge,
          service_percent: totals.servicePercent,
          total: totals.total,
        },
      };
    });

    return NextResponse.json({
      message: 'Sale complete! Bill saved successfully.',
      ...result,
      warnings: result.stock?.warnings || [],
    }, { status: 201 });
  } catch (error) {
    console.error('Create billing order error:', error);
    if (error.code === 'customer_invalid') {
      return NextResponse.json(
        { error: error.message, code: 'customer_invalid' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: 'We could not complete this sale. Please try again.',
        code: 'sale_failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
