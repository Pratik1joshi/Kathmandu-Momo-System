# Kathmandu Momo POS — Production Install (cPanel + PostgreSQL + Node.js)

Fresh install from scratch. ~15 minutes.

## 0. Requirements
- cPanel with **Setup Node.js App** (Node 22).
- **PostgreSQL 14+** (cPanel → PostgreSQL Databases).
- `psql` access (cPanel Terminal, or phpPgAdmin for the SQL files).

## 1. Database
In cPanel → PostgreSQL Databases: create a database + user, grant the user **all**
privileges on the database. Then load the schema + seed (Terminal):

```bash
export PGPASSWORD='your_db_password'
psql -h localhost -U DBUSER -d DBNAME -f deploy/production_schema.sql
psql -h localhost -U DBUSER -d DBNAME -f deploy/production_seed.sql
```

That creates all 44 tables + indexes + constraints and loads the Chart of
Accounts, default cash drawer, default bank, restaurant settings (already branded
**Kathmandu Momo**, Birendranagar, Surkhet) and the first admin. (No
`npm run db:migrate` needed — the seed marks every migration applied.)

Then load the operational defaults and the menu:

```bash
psql -h localhost -U DBUSER -d DBNAME -f deploy/menu-pack/seed_menu.sql
psql -h localhost -U DBUSER -d DBNAME -f deploy/default_seed.sql
```

`seed_menu.sql` must run **before** `default_seed.sql` (recipes reference menu
items). See `deploy/menu-pack/README.txt` for uploading the matching dish photos.

> Alternative for a live/existing DB: `npm run db:pg:init` runs the incremental
> migrations + admin seed instead of the two files above.

## 2. Upload the app
Upload the project (without `node_modules`, `.next`, `.env`, `uploads/*`) to a
folder **outside** `public_html` (e.g. `~/pos`). Keep `uploads/` persistent.

## 3. Environment variables
Copy `.env.example` → `.env` and set real values. Minimum required:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://your-domain.com` (no trailing slash) |
| `DATABASE_URL` | `postgresql://DBUSER:PASSWORD@localhost:5432/DBNAME` (URL-encode special chars, e.g. `@`→`%40`) |
| `SESSION_SECRET` | long random string |
| `CSRF_SECRET` | another long random string |
| `FORCE_SECURE_COOKIES` | `1` |
| `HOSTNAME` | `0.0.0.0` |
| `UPLOADS_DIR` | `./uploads` (or an absolute persistent path) |
| `PGSSL` | `false` (usually, for local cPanel Postgres) |

Optional: `PG_POOL_MAX=5`, `LOG_LEVEL=info`, `RATE_LIMIT_LOGIN=10`,
`RATE_LIMIT_PUBLIC=8`. **Do not** set `PORT` — cPanel injects it.

## 4. Node.js App (cPanel → Setup Node.js App)
- Application root: your upload folder (`~/pos`).
- Application startup file: **`server.js`**.
- Node version: 22. Application mode: **Production**.
- Add the env vars from step 3 in the app's Environment Variables panel
  (or the `.env` file is read too).
- Click **Run NPM Install**, then in the app's terminal: `npm run build`.
- Start / Restart the app. cPanel proxies your domain to it.

## 5. Verify
- `npm run health` (or open the site). Log in at `/login` with **admin, PIN 1234**.
- **Immediately** change the admin password (you are forced to on first login).
- Settings → confirm Business info (pre-seeded), add VAT/PAN, set receipt paper
  size (58/80mm).
- Open `/` — the Kathmandu Momo landing page — and `/menu` for the live menu.

## 6. Uploads & static
- Menu/receipt images are written to `UPLOADS_DIR` and served via `/api/media`.
  Keep this folder out of the release directory so redeploys don't wipe it.
- `next.config.mjs` uses `images.unoptimized` — no `sharp`/native build needed.

## 7. Backups
Schedule a nightly dump (cPanel Cron):
```bash
pg_dump -h localhost -U DBUSER DBNAME | gzip > ~/backups/pos_$(date +\%F).sql.gz
```
Also back up the `uploads/` folder. Keep 7–30 days.

## 8. Security checklist
- [ ] Admin password changed from default.
- [ ] `SESSION_SECRET` / `CSRF_SECRET` are unique random strings.
- [ ] `FORCE_SECURE_COOKIES=1`, site served over HTTPS.
- [ ] `.env` not inside `public_html`; DB user limited to its own DB.
- [ ] `deploy/production_*.sql` not web-served.

## Default login
`admin` / PIN `1234` — **change on first sign-in.**
