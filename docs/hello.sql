BEGIN;

DELETE FROM business_day_audit;
DELETE FROM business_day_sessions;

UPDATE orders
SET business_day_id = NULL,
    carried_from_business_day_id = NULL;

UPDATE kots
SET business_day_id = NULL,
    carried_from_business_day_id = NULL;

UPDATE bills
SET business_day_id = NULL,
    carried_from_business_day_id = NULL;

UPDATE bill_payments
SET business_day_id = NULL;

UPDATE bill_payment_allocations
SET business_day_id = NULL;

UPDATE customer_ledger
SET business_day_id = NULL;

UPDATE bill_corrections
SET business_day_id = NULL;

UPDATE expenses
SET business_day_id = NULL;

UPDATE journal_entries
SET business_day_id = NULL;

UPDATE drawer_sessions
SET business_day_id = NULL;

UPDATE payment_settlements
SET business_day_id = NULL;

UPDATE reservations
SET business_day_id = NULL;

UPDATE salary_payments
SET business_day_id = NULL;

UPDATE salary_advances
SET business_day_id = NULL;

UPDATE stock_movements
SET business_day_id = NULL;

UPDATE wastage_log
SET business_day_id = NULL;

UPDATE savings_deposits
SET business_day_id = NULL;

DELETE FROM business_days;

COMMIT;