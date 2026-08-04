-- Default privileges for the app role. Run as the schema owner.
-- Replace kathmandumomo_app with the PostgreSQL role in your DATABASE_URL.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO kathmandumomo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO kathmandumomo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON FUNCTIONS TO kathmandumomo_app;
