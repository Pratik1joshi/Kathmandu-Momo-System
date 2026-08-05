import Database from '../index.js';

export class BillRepository {
  constructor() {
    this.db = Database.getInstance();
  }
  
  async create(bill) {
    const result = await this.db.run(`
      INSERT INTO bills (
        bill_number, order_id, table_id, subtotal,
        service_charge, service_charge_percent,
        tax, tax_percent, discount_amount, discount_type,
        discount_reason, grand_total, cashier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bill.bill_number || '',
      bill.order_id,
      bill.table_id,
      bill.subtotal,
      bill.service_charge || 0,
      bill.service_charge_percent ?? 0,
      bill.tax || 0,
      bill.tax_percent ?? 0,
      bill.discount_amount || 0,
      bill.discount_type || null,
      bill.discount_reason || null,
      bill.grand_total,
      bill.cashier_id
    ]);
    
    await this.db.run(
      `UPDATE bills SET parent_bill_id = (
         SELECT reopened_from_bill_id FROM orders WHERE id = ?
       ) WHERE id = ?`,
      [bill.order_id, result.lastInsertRowid]
    );

    return result.lastInsertRowid;
  }
  
  async getById(id) {
    const bill = await this.db.get(`
      SELECT b.*, o.order_number, t.table_number,
             u.full_name as cashier_name
      FROM bills b
      JOIN orders o ON b.order_id = o.id
      LEFT JOIN tables t ON b.table_id = t.id
      LEFT JOIN users u ON b.cashier_id = u.id
      WHERE b.id = ?
    `, [id]);
    
    if (bill) {
      bill.payments = await this.db.all(`
        SELECT * FROM bill_payments 
        WHERE bill_id = ?
      `, [id]);
      
      bill.items = await this.db.all(`
        SELECT oi.*, mi.name as item_name
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
      `, [bill.order_id]);
    }
    
    return bill;
  }
  
  async addPayment(billId, payment) {
    return await this.db.run(`
      INSERT INTO bill_payments (bill_id, payment_method, amount, reference_number, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [billId, payment.payment_method, payment.amount, payment.reference_number, payment.notes]);
  }
  
  async markAsPaid(id) {
    return await this.db.run(`
      UPDATE bills 
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);
  }
  
  async getTodaysBills() {
    return await this.db.all(`
      SELECT b.*, o.order_number, t.table_number,
             u.full_name as cashier_name
      FROM bills b
      JOIN orders o ON b.order_id = o.id
      LEFT JOIN tables t ON b.table_id = t.id
      LEFT JOIN users u ON b.cashier_id = u.id
      WHERE DATE(b.created_at) = DATE('now')
      ORDER BY b.created_at DESC
    `);
  }
  
  async getSalesSummary(startDate, endDate) {
    return await this.db.get(`
      SELECT 
        COUNT(*) as total_bills,
        SUM(grand_total) as total_sales,
        AVG(grand_total) as average_bill,
        SUM(CASE WHEN status = 'paid' THEN grand_total ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'unpaid' THEN grand_total ELSE 0 END) as pending_amount
      FROM bills
      WHERE DATE(created_at) BETWEEN ? AND ?
    `, [startDate, endDate]);
  }
}
