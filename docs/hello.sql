SELECT
  current_setting('TimeZone') AS database_timezone,
  pg_typeof(b.created_at) AS created_at_type,
  b.bill_number,
  b.status,
  b.created_at,
  b.paid_at,
  b.created_at::date AS stored_created_date,
  b.paid_at::date AS stored_paid_date,
  b.grand_total
FROM bills b
WHERE b.bill_number IN ('B057', 'B058', 'B059', 'B060', 'B061', 'B062', 'B063', 'B064')
ORDER BY b.bill_number;