-- If login works for wrong PIN (401) but correct PIN returns 500,
-- the app DB user may lack INSERT on sessions. Run as a privileged Postgres user:
--
-- Replace kathmandumomo_app below with the PostgreSQL role in your DATABASE_URL.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kathmandumomo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kathmandumomo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kathmandumomo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kathmandumomo_app;
