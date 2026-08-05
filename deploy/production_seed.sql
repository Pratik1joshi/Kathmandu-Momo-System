-- =====================================================================
-- Restaurant POS — production seed (run AFTER production_schema.sql).
-- Idempotent: safe to re-run. Loads the mandatory lookup data + first admin.
-- =====================================================================

-- pgcrypto is needed to hash the admin PIN below.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- Chart of Accounts (the accounting engine posts to these codes) --------
INSERT INTO accounts (code, name, type, subtype, is_system) VALUES
  ('1000','Assets','asset',NULL,1),
  ('1010','Cash on Hand','asset','cash',1),
  ('1020','Bank','asset','bank',1),
  ('1100','Card Clearing','asset','clearing',1),
  ('1110','eSewa Clearing','asset','clearing',1),
  ('1120','Khalti Clearing','asset','clearing',1),
  ('1130','QR / Fonepay Clearing','asset','clearing',1),
  ('1140','Online Clearing','asset','clearing',1),
  ('1200','Inventory','asset','inventory',1),
  ('1300','Accounts Receivable','asset','receivable',1),
  ('2000','Liabilities','liability',NULL,1),
  ('2010','Accounts Payable','liability','payable',1),
  ('3000','Equity','equity',NULL,1),
  ('3010','Owner''s Equity','equity',NULL,1),
  ('3020','Opening Balance Equity','equity',NULL,1),
  ('4000','Income','income',NULL,1),
  ('4010','Sales Revenue','income','sales',1),
  ('4020','Other Income','income',NULL,1),
  ('5000','Expenses','expense',NULL,1),
  ('5010','Purchases / COGS','expense','cogs',1),
  ('5020','Operating Expenses','expense','operating',1),
  ('5030','Payroll','expense','payroll',1),
  ('5040','Wastage / Inventory Loss','expense','wastage',1),
  ('5050','Payment Processing Fees','expense','fees',1),
  ('5060','Cash Over / Short','expense','variance',1)
ON CONFLICT (code) DO NOTHING;

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code='1000') WHERE code IN ('1010','1020','1100','1110','1120','1130','1140','1200','1300') AND parent_id IS NULL;
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code='2000') WHERE code IN ('2010') AND parent_id IS NULL;
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code='3000') WHERE code IN ('3010','3020') AND parent_id IS NULL;
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code='4000') WHERE code IN ('4010','4020') AND parent_id IS NULL;
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code='5000') WHERE code IN ('5010','5020','5030','5040','5050','5060') AND parent_id IS NULL;

-- ---- One cash drawer + one bank (multi-drawer / multi-bank ready) -----------
INSERT INTO cash_drawers (name) SELECT 'Main Drawer' WHERE NOT EXISTS (SELECT 1 FROM cash_drawers);
INSERT INTO bank_accounts (name, account_id)
  SELECT 'Primary Bank', (SELECT id FROM accounts WHERE code='1020') WHERE NOT EXISTS (SELECT 1 FROM bank_accounts);

-- ---- Restaurant settings (VAT/service, receipt, ordering, reservation timers)
INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('restaurant_name','Kathmandu Momo'),
  ('restaurant_address','Birendranagar, Surkhet, Karnali, Nepal'),
  ('restaurant_phone','+977 984-9216081'),
  ('restaurant_email',''),
  ('vat_number',''),
  ('pan_number',''),
  ('vat_percentage','13'),
  ('service_charge_percentage','10'),
  ('receipt_footer','Thank you for visiting Kathmandu Momo!'),
  ('receipt_paper_size','80'),
  ('website','https://kathmandumomo.com.np'),
  ('qr_ordering_enabled','true'),
  ('bank_qr_image',''),
  ('esewa_qr_image',''),
  ('reservation_hold_minutes','30'),
  ('reservation_grace_minutes','20'),
  ('reservation_dining_minutes','90'),
  ('reservation_cleaning_minutes','10'),
  ('reservation_auto_cancel_minutes','20'),
  ('reservation_min_lead_minutes','60')
ON CONFLICT (setting_key) DO NOTHING;

-- ---- First admin. Login is PIN-based. Default PIN 1234 — CHANGE IMMEDIATELY --
-- (must_change_password forces a reset on first sign-in.)
INSERT INTO users (username, password_hash, full_name, role, is_active, must_change_password)
VALUES ('admin', crypt('1234', gen_salt('bf', 12)), 'Kathmandu Momo Admin', 'admin', 1, 1)
ON CONFLICT (username) DO NOTHING;

-- ---- Mark every migration as applied so `npm run db:migrate` is a no-op -----
INSERT INTO schema_migrations (version) VALUES
  ('001_init'),('002_tables_extra_columns'),('003_expenses_notes_stock'),('004_recipe_bom'),
  ('005_leads_viewed_at'),('006_inventory_expense_upgrade'),('007_inventory_category'),('008_inventory_ledger'),
  ('009_wastage_reason_vocabulary'),('010_list_query_indexes'),('011_unit_conversions'),('012_inventory_categories'),
  ('013_table_floors_types'),('014_payroll'),('015_accounting'),('016_expense_categories'),
  ('017_accounting_hardening'),('018_accounting_numeric'),('019_supplier_ledger'),('020_bank_reconciliation'),
  ('021_table_qr_token'),('022_kitchen_timing'),('023_bill_corrections'),
  ('024_reopen_bills'),('025_table_ops'),('026_menu_2083'),('027_admin_enhancements')
ON CONFLICT (version) DO NOTHING;
