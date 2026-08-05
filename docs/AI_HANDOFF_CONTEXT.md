# AI Handoff Context

Last updated: 2026-08-05

## Latest implementation: Website and WhatsApp ordering

The app now has `/order-online`, non-guessable `/track-order/[token]`, a unified Admin/Cashier queue, explicit sources, server totals, idempotent submission, configured `wa.me` generation, and transactional one-order/one-KOT acceptance. Migration `028_online_ordering.sql` owns the additive schema. `npm run check:online-orders` verifies core invariants. See `docs/WEBSITE_WHATSAPP_ORDERING.md` for exact routes and known limits.

## Read this first

This is the current implementation state of the Kathmandu Momo System for the next AI or engineer. The worktree is intentionally dirty and contains user-owned documentation/assets plus the implementation described below. Do not discard, reset, stage, commit, push, deploy, or modify production data unless the user explicitly asks.

The application builds successfully, but it is **not yet approved as production-ready**. Runtime QA, PostgreSQL migration/restore testing, accounting and inventory reconciliation, dependency remediation, and release sign-off remain open gates.

## Verified repository shape

- Framework: Next.js 16 App Router, React 19, Node.js 22.
- Data: PostgreSQL production path and SQLite local fallback.
- UI: Tailwind CSS 4, Radix primitives, Lucide icons.
- Current source count: 68 page files, 104 API route files, 31 SQL migration files, and 44 `CREATE TABLE public.*` statements in the production schema dump.
- Full production build: passed on 2026-08-05 and generated 147 App Router entries.
- Roles retained: Admin, Cashier, Waiter, Kitchen.

## Implemented in this worktree

### Documentation and product context

- Added the complete documentation suite under `docs/`.
- Added `PRODUCT.md` as durable product/design context for frontend work.
- Added this handoff and browser QA screenshots under `docs/screenshots/`.
- `docs/QA_CHECKLIST.md` is the executable production QA baseline. A checked item must have environment/build/evidence, not only code inspection.

### Official menu 2083

- Source: `KTM MOMO FOOD MENU 2083.docx`.
- Canonical structured data: `data/menu-2083.json`.
- Generator: `scripts/build-menu-2083.mjs`.
- Generated fresh-install seed: `deploy/menu-pack/seed_menu.sql`.
- Generated non-destructive upgrade: `migrations/026_menu_2083.sql`.
- Generated result: 15 categories and 171 numeric-priced orderable items.
- Existing menu/categories are deactivated by the upgrade before official categories/items are upserted. Historical rows are retained.
- Slash-separated choices were modeled as separate orderable items because current ordering clients do not consistently consume `menu_item_variants`.

Owner/QA must confirm two source ambiguities:

- `Mutton Sekuwa / Mutton Sekuwa Set` had one printed price (Rs. 355); both are currently Rs. 355.
- `Veg Pizza Medium / Large` had one printed price (Rs. 595); it is currently one `Veg Pizza - Medium/Large` item at Rs. 595.

Tax, service charge, recipes, stock links, modifiers, and availability were not invented from the Word document.

### Kathmandu Momo branding

- Approved source logo: `public/images/kathmandu-momo/logo.png`.
- Rebuilt App Router, ICO, Apple, 32px, 192px, and 512px icon assets.
- Root title: `Kathmandu Momo | Restaurant POS & Online Ordering`.
- Page title pattern: `%s | Kathmandu Momo`.
- Manifest theme: Kathmandu Momo red (`#e30613`), with `?v=2083` icon cache invalidation.
- Public landing favicon/title/brand verification passed in the local browser.

### Analytics and inventory dashboards

- `/admin/analytics` reuses the established real-data reports engine instead of parallel calculations.
- Presets: Today, Yesterday, Nepal-local Monday-to-today This Week, This Month, This Year, Custom.
- `/admin/inventory/dashboard` is a focused inventory view of the same report/query system.
- Both rendered without a visible error state against the seeded local QA database.

### Website CMS and media

- Admin page: `/admin/cms`; APIs: `/api/admin/cms`, `/api/admin/media`, `/api/public/cms`.
- Whitelisted fields cover brand/contact, home, about, reservations, gallery, contact copy, and SEO.
- POS menu remains the sole source for menu names, prices, and availability.
- Uploads reuse persistent storage with magic-byte, extension, size, dimension, filename, and traversal checks.
- Media archive checks references. Upload/archive/content update actions write audit events.
- Public landing fetches published CMS values with built-in content as fallback.
- Migration 027 adds CMS content/media and append-only audit tables.

Known CMS limits:

- Gallery editing is JSON-based rather than drag-sort UI.
- Client-applied landing metadata updates the browser after load. Crawler-level dynamic SEO still needs a server-rendered landing migration if required.
- cPanel restart/deploy persistence must be proved with `UPLOADS_DIR` outside the release directory.

### Admin bills and safe supplementation

- Central page/API: `/admin/bills`, `/api/admin/bills`.
- Includes server-side tabs/counts/search/date filtering/pagination, desktop table, mobile cards, details, payments, KOT state, corrections, and revision history.
- Reopen now creates a linked **empty supplemental order**, not void-and-rebill.
- Original paid bill, completed order, served items, payment, stock history, and sale journal stay immutable.
- New order links through `orders.reopened_from_bill_id`; eventual bill links through `bills.parent_bill_id`.
- One active supplement is enforced by locking/checks and a partial unique PostgreSQL index.
- Reason/permission/table-state checks run in a transaction and write correction/audit records.
- Reopen itself has amount zero. Only newly finalized items use existing KOT, billing, stock, and accounting services.
- Lower totals require existing refund/credit/void flow; history is never overwritten.

`npm run check:reopen` passed and proves original invoice/order/items/payment/journal immutability, empty supplement creation, table reassignment, zero correction amount, and duplicate-active rejection.

### Production API error policy

- `lib/api-error-policy.js` centralizes safe error bodies.
- Production unexpected 500 bodies expose only a safe fallback message.
- Development diagnostics remain environment-gated; server logging remains.
- `npm run check:api-errors` passed for stack, SQL, credential, and path exclusion.

## Migrations

Apply only after backup and isolated PostgreSQL rehearsal:

1. `026_menu_2083.sql`: official menu upgrade; retains historical rows.
2. `027_admin_enhancements.sql`: CMS/media/audit tables and supplemental bill links/index.

Never run `deploy/menu-pack/seed_menu.sql` against existing production. It is a fresh-install seed and intentionally deletes menu rows.

## Verification already executed

| Command/check | Result |
| --- | --- |
| `npm ci` | Passed; 654 packages installed. |
| `npm run build:menu-2083` | Passed; 15 categories, 171 items. |
| `npm run check:api-errors` | Passed. |
| `npm run check:reopen` | Passed on isolated SQLite. |
| `npm run build` | Passed; 147 routes generated. |
| Browser QA at 1280x800 and 360x800 | Bills, CMS, analytics, inventory dashboard, public title/favicon checked. A mobile table defect was found and fixed with mobile cards. |
| `npm run lint` | Failed on repository baseline: 33 errors and 41 warnings in legacy files. |
| Enhancement-target ESLint | New bill/API modules pass; shared pre-existing `admin-layout.jsx` still triggers 3 React effect-rule errors and CMS uses 2 deliberate upload-preview `<img>` elements. |
| `npm audit --omit=dev --audit-level=high` | Failed: 3 high-severity dependency findings in Next.js, PostCSS, and Sharp. |

## Production blockers and next work

1. Upgrade/test Next.js, PostCSS, and Sharp to clear the high audit. Do not run `npm audit fix --force` blindly; it proposes Next.js 16.3.0 and needs full regression.
2. Resolve or formally approve the 33 repository-wide ESLint errors.
3. Apply migrations 026/027 to an isolated PostgreSQL copy, then prove backup/restore.
4. Reconcile one sale/refund/supplement from invoice to payment, stock, COGS, and ledger.
5. Reconcile inventory value, recipe consumption, wastage, and mixed units to movements.
6. Test concurrent reopen/double payment, insufficient stock, closed period/register, KOT add-ons, unchanged supplement, and lower-total refund on PostgreSQL.
7. Test CMS valid/oversized/disguised/polyglot uploads, reference deletion, and restart/deploy persistence.
8. Execute complete Admin/Cashier/Waiter/Kitchen, reservation, QR, receipt 58mm/80mm, accessibility, browser, and responsive QA from `QA_CHECKLIST.md`.
9. Record owner/finance/operations/QA approvals.

Until these gates pass, call this a **build-verified enhancement candidate**, not production-ready.

## Visual evidence

- `docs/screenshots/admin-bills-desktop.png`
- `docs/screenshots/admin-bills-mobile.png`
- `docs/screenshots/admin-cms-desktop.png`

## Recommended next action

Remediate dependencies in a reviewable change and rerun build/invariant checks. Then rehearse migrations and reconciliation on an isolated PostgreSQL QA database before any production deployment decision.
