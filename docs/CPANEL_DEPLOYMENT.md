# cPanel + PostgreSQL deployment runbook

Target: **Node.js 22** Application Manager + **PostgreSQL** created in cPanel, dedicated domain/subdomain (not a subpath).

## 1. Create PostgreSQL database

1. cPanel → **PostgreSQL Databases**
2. Create database, e.g. `account_pos`
3. Create user with a strong password
4. Add the user to the database with **ALL PRIVILEGES**
5. Note host (often `localhost`), port `5432`, db name, user, password

### URL-encode the password

If the password contains `@`, `#`, `/`, `%`, etc., encode it for `DATABASE_URL`:

| Char | Encoding |
|------|----------|
| `@`  | `%40`    |
| `#`  | `%23`    |
| `/`  | `%2F`    |
| `%`  | `%25`    |
| `:`  | `%3A`    |
| ` `  | `%20`    |

Example:

```text
DATABASE_URL=postgresql://account_posuser:p%40ssw0rd@localhost:5432/account_pos
```

## 2. Create Node.js 22 application

1. cPanel → **Setup Node.js App**
2. Node.js version: **22.x**
3. Application root: path to this project (e.g. `pos-restaurent-system`)
4. Application URL: your domain/subdomain
5. Application startup file: **`server.js`**
6. Environment variables (set in the Node.js UI):

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://pos.yourdomain.com` |
| `DATABASE_URL` | see above |
| `PG_POOL_MAX` | `5` |
| `PGSSL` | `false` (typical for local cPanel Postgres) |
| `UPLOADS_DIR` | absolute path preferred, e.g. `/home/USER/pos-uploads` |
| `IMAGES_PATH` | `/uploads` |
| `SESSION_SECRET` | long random string |
| `CSRF_SECRET` | long random string |
| `FORCE_SECURE_COOKIES` | `1` |
| `LOG_LEVEL` | `info` |
| `ADMIN_USERNAME` | for seed only |
| `ADMIN_PASSWORD` | min 8 chars, for seed only |

Copy `.env.example` as a checklist. Do **not** commit `.env`.

## 3. Writable uploads directory

```bash
mkdir -p ~/pos-uploads/menu
chmod 750 ~/pos-uploads
```

Set `UPLOADS_DIR` to that absolute path. Files are served via `/uploads/*` → `/api/media/*` rewrite (no filesystem path disclosure).

Include `~/pos-uploads` in backups.

## 4. Install, migrate, seed, build

In SSH / Terminal, from the application root (activate the Node.js virtual env if cPanel provides a button/command):

```bash
npm ci
# or: npm install --omit=dev   # after a successful local lockfile sync

npm run db:migrate
ADMIN_USERNAME=admin ADMIN_PASSWORD='YourStrongPasswordHere' npm run db:seed

npm run build
# Uses Webpack (not Turbopack) — required on cPanel because node_modules is a symlink
```

Then **Restart** the Node.js application in cPanel.

## 5. Verify

```bash
curl -sS "$APP_URL/api/health"
# expect: {"ok":true,"database":"up",...}
```

Checklist:

- [ ] Login as seeded admin; change password if `must_change_password`
- [ ] Create waiter / cashier / kitchen users
- [ ] Public reservation form works; rate limit returns 429 when abused
- [ ] Waiter opens table / order; kitchen board updates without N+1 storms
- [ ] Cashier takes payment; second payment on same order fails
- [ ] Admin dashboard loads; reports load
- [ ] Menu image upload (admin) succeeds; image appears on menu
- [ ] `/api/health` returns 200 after restart

## 6. Release updates

```bash
# pull or upload new release
npm ci
npm run db:migrate
npm run build
# Restart Node.js app in cPanel
```

Do **not** re-run seed on existing production DBs (seed is for fresh installs).

## 7. Backups (cron)

Example daily dump + uploads tarball:

```bash
#!/bin/bash
set -euo pipefail
STAMP=$(date +%F)
BACKUP_DIR="$HOME/backups/pos"
mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
find "$BACKUP_DIR" -type f -mtime +14 -delete
```

Test restore on a staging database at least once before go-live.

## 8. Rollback policy

1. Keep previous build artifact when possible.
2. Restore Postgres from last `pg_dump` **before** applying a bad migration.
3. Migrations are forward-only — add a new `migrations/00N_*.sql` file; do not edit applied SQL in place.

## 9. Logs

- Application Manager / Passenger / Node stderr in cPanel
- Structured JSON logs via `lib/logger.js` (no passwords, tokens, or absolute paths)

## 10. Commands reference

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply `migrations/*.sql` |
| `npm run db:seed` | Fresh admin + settings + sample tables |
| `npm run build` | Production Next.js build |
| `npm start` | `node server.js` (cPanel startup) |
| `npm run health` | Hit `/api/health` |
