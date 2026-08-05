# Technical Requirements Document

## 1. System profile

| Area | Implementation |
|---|---|
| Runtime | Node.js `>=22 <23` |
| Framework | Next.js 16 App Router, React 19 |
| UI | Tailwind CSS 4, Radix UI, Recharts, Lucide |
| Production database | PostgreSQL; `pg` connection pool |
| Local database | SQLite through optional `better-sqlite3` and local seed |
| Authentication | bcrypt credentials, database sessions, bearer/cookie support |
| Hosting entry | `server.js`; cPanel-compatible HTTP server and graceful shutdown |
| Assets | bundled public assets plus persistent `UPLOADS_DIR` served by `/api/media` |
| Printing | browser thermal receipt rendering for 58mm/80mm |

Repository snapshot: 64 page files, 100 API route files, and 45 tables in `deploy/production_schema.sql`.

## 2. Architecture

```text
Browser / mobile / POS terminal
  -> Next.js pages and static landing page
  -> App Router route handlers
  -> auth, CSRF, permission, validation, rate-limit services
  -> domain libraries and repositories
  -> database adapter
  -> PostgreSQL (production) or SQLite (development)
```

The same order, bill, inventory, and accounting services are shared across waiter, cashier, admin, kitchen, and public QR flows. Production must never silently fall back to a local SQLite file when PostgreSQL is expected.

## 3. Code boundaries

- `app/`: pages, layouts, errors, and route handlers.
- `components/`: domain and reusable UI components.
- `lib/`: auth, validation, domain rules, accounting, reporting, printing, uploads, and database access.
- `lib/db/repositories/`: menu, table, order, KOT, and bill persistence boundaries.
- `migrations/`: forward-only incremental PostgreSQL changes.
- `deploy/`: fresh production schema/seed and menu/default seed packs.
- `scripts/`: migration, seed, health, asset build, and invariant checks.
- `public/`: static landing page, brand images, icons, and bundled menu imagery.

## 4. Runtime requirements

- Required production values: `NODE_ENV=production`, `APP_URL`, `DATABASE_URL`, strong `SESSION_SECRET` and `CSRF_SECRET`, `FORCE_SECURE_COOKIES=1`, `HOSTNAME=0.0.0.0`, and persistent `UPLOADS_DIR`.
- cPanel supplies `PORT`; do not hardcode it.
- PostgreSQL connection pool and SSL values must match the host.
- Secrets must be injected by the host or a protected `.env`, never committed or exposed to the client.
- Releases use `npm ci` and `npm run build` (`next build --webpack`).

## 5. Data and transaction requirements

- PostgreSQL schema and `schema_migrations` are authoritative in production.
- Multi-table business operations use a database transaction: payment, accounting post, inventory-impacting receipts/corrections, and table/order operations.
- Foreign keys, checks, uniqueness, and partial indexes remain enabled.
- Currency values must follow application rounding consistently; accounting migration `018_accounting_numeric.sql` is part of the required chain.
- Query endpoints use bounded pagination/date ranges where exposed and indexes for common order/status/date lookups.
- Production migrations are append-only; never edit an already-applied migration.

## 6. API requirements

- JSON is the default request/response format; uploads use multipart form data.
- Protected routes call shared authentication and enforce role or action permission on the server.
- Cookie-authenticated unsafe methods require double-submit CSRF. Bearer clients are subject to session verification.
- Validation failures use 4xx; unauthenticated 401; forbidden 403; conflict 409 where defined; rate limit 429; removed legacy features 410; safe unexpected failure 500.
- API responses must not include secrets, SQL text, stack traces, or absolute paths in production.
- Public order endpoints recalculate price and availability on the server.

## 7. UI requirements

- Staff surfaces support common desktop/tablet sizes; public and QR flows support mobile widths.
- Every asynchronous screen provides loading, empty, success, and recoverable error states.
- Forms expose field-level validation and prevent accidental duplicate submission.
- Keyboard navigation, visible focus, semantic labels, contrast, zoom to 200%, and reduced-motion behavior are verified.
- Print output is legible on configured 58mm and 80mm paper and excludes navigation/control chrome.

## 8. Security and observability

- Middleware emits CSP, nosniff, frame protection, referrer policy, permissions policy, and production HSTS.
- Login/public submissions are DB-rate-limited by client IP.
- Structured logs must allow request/error diagnosis while redacting credentials, tokens, personal data, and filesystem paths.
- Health checks verify database reachability but disclose no secret/configuration detail.
- Application shutdown closes the HTTP listener and database pool on SIGTERM/SIGINT.

## 9. Verification commands

```bash
npm run lint
npm run build
npm run health
node scripts/check-accounting.mjs
node scripts/check-entry-math.mjs
node scripts/check-inventory-ledger.mjs
node scripts/check-unit-conversions.mjs
node scripts/check-units.mjs
npm run check:permissions
npm run check:table-ops
npm run check:reopen
npm run check:waiter
```

Database-dependent scripts must run against an isolated QA database. A production build, database restore drill, and live smoke suite are mandatory release evidence.

## 10. Known technical constraints

- The landing page is a static HTML file rewritten to `/`; changes require separate public/staff validation.
- Uploaded files are outside the release bundle and require a separate backup.
- Browser printing depends on OS/browser/printer configuration and must be tested on the real terminal.
- Local SQLite is useful for development but does not replace PostgreSQL acceptance testing.

