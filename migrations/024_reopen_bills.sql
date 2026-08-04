-- 024: reopen paid bills + proforma (print-before-pay) support.
--
-- Reopen model = void-and-rebill: reopening a paid bill reverses its sale
-- journal, marks the bill 'reopened' (freeing the one-paid-per-order slot),
-- reactivates the order and re-occupies the table. The customer's extra items
-- are added and a fresh final bill is taken. Every reopen is logged in
-- bill_corrections (type 'reopen') with who / why / when — nothing is deleted.
--
-- Proforma: orders.bill_printed_at records that a bill was printed for the
-- customer to check WITHOUT completing payment; the order stays open.

-- Allow 'reopen' as a correction type (was: void, refund).
ALTER TABLE bill_corrections DROP CONSTRAINT IF EXISTS bill_corrections_type_check;
ALTER TABLE bill_corrections
  ADD CONSTRAINT bill_corrections_type_check CHECK (type IN ('void', 'refund', 'reopen'));

ALTER TABLE bills  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP;
ALTER TABLE bills  ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_printed_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reopened_from_bill_id INTEGER;
