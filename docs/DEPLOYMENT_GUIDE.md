# Deployment Guide

Target: a dedicated HTTPS domain/subdomain on cPanel, Node.js 22, and PostgreSQL 14+. Use a staging environment first. This guide complements `deploy/INSTALL.md` and `docs/CPANEL_DEPLOYMENT.md`.

## 1. Release inputs

- Approved commit/tag and recorded build identifier.
- Node.js 22 and lockfile-based dependency install.
- PostgreSQL database/user limited to the application database.
- Persistent, writable upload directory outside disposable release folders.
- TLS certificate and domain/proxy mapping.
- Strong unique production secrets and changed initial admin credential.
- A tested backup, restore location, maintenance window, owner, and rollback decision maker.

## 2. Required environment

Copy `.env.example` as a checklist; do not commit the real file.

| Variable | Production requirement |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | Public HTTPS origin, no trailing slash |
| `DATABASE_URL` | PostgreSQL URL; URL-encode password characters |
| `SESSION_SECRET` | Unique random secret, not example/default |
| `CSRF_SECRET` | Different unique random secret |
| `FORCE_SECURE_COOKIES` | `1` |
| `HOSTNAME` | `0.0.0.0` |
| `PORT` | Supplied by cPanel |
| `UPLOADS_DIR` | Persistent absolute path preferred |
| `IMAGES_PATH` | `/uploads` |
| `PGSSL` | Match host; commonly `false` for local cPanel PostgreSQL |
| `PG_POOL_MAX` | Sized for host connection limit, default example 5 |
| `RATE_LIMIT_LOGIN`, `RATE_LIMIT_PUBLIC` | Approved thresholds |
| `LOG_LEVEL` | `info` unless temporarily troubleshooting |

Seed-only admin/business variables are not a substitute for changing settings and credential after first login.

## 3. Fresh database install

Create database/user and grant only the required database privileges. From the application root:

```bash
export PGPASSWORD='database-password'
psql -h localhost -U DBUSER -d DBNAME -f deploy/production_schema.sql
psql -h localhost -U DBUSER -d DBNAME -f deploy/production_seed.sql
psql -h localhost -U DBUSER -d DBNAME -f deploy/menu-pack/seed_menu.sql
psql -h localhost -U DBUSER -d DBNAME -f deploy/default_seed.sql
```

The menu seed precedes defaults because recipes reference menu items. Confirm 45 tables, migration records, baseline accounts/settings/tables/menu, and exactly the intended first admin. Do not expose SQL files via the web root.

For an existing database, use the incremental path only:

```bash
npm run db:migrate
```

Do not rerun a fresh seed over live business data.

## 4. Application install

1. Place the app outside `public_html` where possible; exclude `.env`, `node_modules`, `.next`, local databases, logs, and uploads from release archives.
2. Create `UPLOADS_DIR`, restrict permissions, and verify the Node process can create/read a test image.
3. Configure cPanel Setup Node.js App: Node 22, Production, application root, domain, startup file `server.js`.
4. Install and build:

```bash
npm ci
npm run db:migrate
npm run build
```

5. Restart the Node application. Verify logs show a clean start and PostgreSQL connection, not SQLite fallback.

## 5. Pre-traffic verification

```bash
npm run health
```

- [ ] `/api/health` returns 200 and database up without sensitive detail.
- [ ] `/`, `/menu`, `/login`, and one role landing route load over HTTPS.
- [ ] Default admin credential is changed; waiter, kitchen, and cashier test accounts exist.
- [ ] Security headers and secure cookies are present on the real domain.
- [ ] Menu images and one authorized upload survive an app restart.
- [ ] One isolated dine-in order reaches KOT, bill, payment, receipt, released table, stock movement, and balanced journal.
- [ ] Public reservation and valid/invalid QR order work.
- [ ] Logs contain no stack/SQL/path/token leakage.

Use the complete `QA_CHECKLIST.md` for release acceptance.

## 6. Updating an existing release

1. Announce maintenance and stop new writes if the migration requires it.
2. Record current release, run `pg_dump`, archive uploads, and verify artifacts are readable.
3. Deploy the approved code, run `npm ci`, apply forward migrations, and run `npm run build`.
4. Restart, health-check, inspect migrations/logs, and execute the P0 smoke/business reconciliation set.
5. Reopen traffic only after release owner approval.

## 7. Backup and restore

Back up database and uploads on the same schedule. Keep 7–30 days according to policy and store copies outside the application host.

```bash
pg_dump -h localhost -U DBUSER DBNAME | gzip > /protected/backups/pos_DATE.sql.gz
tar -czf /protected/backups/uploads_DATE.tar.gz -C /path/to uploads
```

Quarterly and before major releases, restore to an empty staging database. Confirm schema/migrations, representative row counts, login, images, source documents, stock balances, trial balance, and key reports. A backup that has not been restored is not accepted as proven.

## 8. Rollback

- Application-only issue with compatible schema: redeploy the prior tested build and restart.
- Forward-compatible data fix: deploy a new migration/fix; never edit an applied migration.
- Destructive/incompatible data issue: stop writes, preserve evidence/current dump, obtain owner approval, restore the matching database and uploads, deploy the matching code, and reconcile lost transactions.
- Do not use `git reset --hard` or overwrite the only database/backup as an operational rollback method.

Record reason, timestamps, decision maker, build/schema versions, validation, and any manually re-entered transactions.

## 9. Post-release monitoring

For at least the first business cycle monitor HTTP 5xx/4xx spikes, login failures/429, database pool errors, slow routes, disk usage/uploads, failed prints, duplicate/conflict errors, journal imbalance, payment-to-bill reconciliation, stock anomalies, and user-reported workflow friction.

