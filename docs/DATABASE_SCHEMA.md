# Database Schema Guide

Production uses PostgreSQL. `deploy/production_schema.sql` is the fresh-install snapshot; `migrations/*.sql` is the ordered upgrade history. At the current snapshot there are **45 tables**, including `table_ops_log`.

## 1. Domain map

| Domain | Tables |
|---|---|
| Identity/security | `users`, `sessions`, `devices`, `rate_limits` |
| Menu | `menu_categories`, `menu_items`, `menu_item_variants` |
| Tables/reservations/customers | `table_floors`, `table_types`, `tables`, `table_ops_log`, `reservations`, `customers`, `inquiries` |
| Orders/kitchen/billing | `orders`, `order_items`, `kots`, `kot_items`, `bills`, `bill_payments`, `bill_corrections` |
| Inventory/recipes | `inventory_categories`, `inventory_items`, `stock_items`, `stock_movements`, `unit_conversions`, `recipes`, `recipe_items`, `wastage_log` |
| Purchasing/expenses | `suppliers`, `purchases`, `purchase_items`, `expense_categories`, `expenses` |
| Employees/payroll | `users`, `salary_payments` |
| Accounting | `accounts`, `journal_entries`, `journal_lines`, `cash_drawers`, `drawer_sessions`, `bank_accounts`, `bank_reconciliations`, `payment_settlements` |
| Configuration/operations | `system_settings`, `schema_migrations` |

## 2. Principal relationships

- A user owns sessions and may be attributed to orders, bills, KOT preparation, payroll, wastage, and operational logs.
- A floor and table type classify tables. A table may have reservations and orders and owns a QR token.
- An order belongs to a table/customer/waiter as applicable and has many order items and KOTs.
- A KOT belongs to an order and has KOT items tied to order/menu items.
- A bill belongs to an order and has payments and corrections. The schema enforces at most one paid bill per order.
- A menu item belongs to a category and may link to variants, inventory, or recipe output.
- A recipe has ingredient lines referencing inventory/recipe inputs.
- A purchase belongs to a supplier and has purchase lines that affect inventory.
- A journal entry has two or more journal lines referencing accounts and optionally drawer, bank, or supplier sub-ledgers.

## 3. High-value integrity rules

- Primary keys and foreign keys resolve; intentional `ON DELETE` behavior must be exercised.
- `users.username`, session tokens, bill numbers, account codes, setting keys, and applicable source references are unique.
- Partial unique index permits at most one bill with `status='paid'` for an order.
- Monetary/quantity check constraints reject invalid negatives where defined.
- Journal debits and credits are non-negative, valid numeric values and balance per entry.
- Table QR tokens are unguessable, unique, and rotatable.
- `schema_migrations` contains every applied migration exactly once.

## 4. Migrations

Migrations `001_init.sql` through `025_table_ops.sql` cover the base model and subsequent recipes, leads, inventory/expense upgrades, ledger, vocabulary, indexes, units, table taxonomy, payroll, accounting, expense categories, accounting hardening/numeric conversion, supplier ledger, bank reconciliation, QR token, kitchen timing, bill corrections/reopen, and table operations.

For an existing production database:

```bash
npm run db:migrate
```

For a fresh database, follow `DEPLOYMENT_GUIDE.md`. Do not modify an applied migration; create the next numbered migration and update the fresh schema snapshot.

## 5. Schema QA queries

Run against an isolated restored QA database and adapt schema qualification if needed:

```sql
-- Applied migrations
SELECT name, applied_at FROM schema_migrations ORDER BY name;

-- Paid bill uniqueness should return zero rows
SELECT order_id, COUNT(*)
FROM bills WHERE status = 'paid'
GROUP BY order_id HAVING COUNT(*) > 1;

-- Journal imbalance should return zero rows
SELECT journal_entry_id,
       SUM(debit) AS debits,
       SUM(credit) AS credits
FROM journal_lines
GROUP BY journal_entry_id
HAVING ABS(SUM(debit) - SUM(credit)) > 0.01;

-- Orphan order items should return zero
SELECT oi.id FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL;

-- Expired sessions can be reviewed/purged by the application policy
SELECT COUNT(*) FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
```

Also inspect orphan KOT lines, bill payments, purchase lines, recipe lines, journal lines, reservation links, and stock movements using equivalent left joins.

## 6. Backup and privacy

- Back up PostgreSQL and `UPLOADS_DIR` together with a timestamp and release identifier.
- Encrypt and access-control dumps because they contain employee/customer data and credential hashes/session records.
- Restore into a separate database and verify row counts, constraints, migrations, login, images, an order/payment, and financial totals.
- Never use a raw production dump for general QA unless it is explicitly authorized and sanitized.

