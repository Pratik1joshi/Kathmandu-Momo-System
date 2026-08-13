# Phase 1 — Repository & Regression Audit / Impact Map

_AADHAR POS → Dim Sum Puri Fastfood Restaurant (counter-service, single-admin)._

## Stack (verified, not assumed)

| Aspect | Reality |
|--------|---------|
| Framework | **Next.js 16.0.7** (App Router, `--webpack`), React 19.2, custom `server.js` (cPanel/Node) |
| Node engine | `>=22 <23` (do **not** change to install design skills) |
| DB | **PostgreSQL** in prod (`pg`), **SQLite** dev fallback (`better-sqlite3`, auto-seeds demo data). Adapter converts `?`→`$n`. |
| Auth | Username + PIN/password (**bcrypt**), stateless base64 session token healed into `sessions`. Roles: `admin / cashier / waiter / kitchen`. |
| UI | Tailwind v4, Radix UI, lucide-react, sonner, recharts. Existing design system in `components/ui`. |
| Accounting | Double-entry engine (`lib/accounting*.js`); every event posts one balanced journal; **no stored balances**. |
| Migrations | `migrations/001…023` (Postgres, via `scripts/migrate.mjs`); SQLite DDL inline in `lib/db/sqlite-seed.js`; `deploy/production_schema.sql` for fresh installs. |

## Baseline (before changes)

- `SKIP_DB_ON_BUILD=1 npm run build` → **passes (exit 0)**.
- `npm run lint` → **32 errors, 42 warnings — all pre-existing** (mostly `react-hooks/set-state-in-effect`, `exhaustive-deps`, `next/no-img-element`). These are the regression baseline; new work must not add to them.

## Impact map (what this conversion touches)

| Area | Location | Change |
|------|----------|--------|
| Public landing | `public/sundar.html` (static, rewritten from `/` by `middleware.js`), `app/layout.js` metadata | Replace with Dim Sum Puri site (Phase 4). |
| Public menu | `app/menu/page.jsx`, `app/api/public/menu/route.js`, `lib/public-menu.js` | Reads live DB — no price drift once menu imported. |
| Login | `app/login/page.jsx` ("Sundar Bagaicha Events" staff picker) | Replace with clean single-admin login (Phase 2). |
| Roles / guards | `lib/auth/auth.js`, `lib/api-guard.js` (`requireAuth`), `components/admin/admin-layout.jsx` (`checkAuth` requires `role==='admin'`) | Keep schema roles; gate to ADMIN via deployment profile + guards. |
| Admin nav | `components/admin/admin-layout.jsx` `navGroups` | Hide waiter/kitchen/table widgets for counter mode; keep modules reachable/historical. |
| Counter sale | `/admin/billing`, `/cashier/*`, `OrderRepository`, `bills` payment API | Make New Sale the primary path, no waiter/table/KDS required. |
| Menu data | `menu_categories`, `menu_items`, `menu_item_variants` | **Phase 3 importer (DONE)** — idempotent, keyed by `source_ref`. |
| Identity | `system_settings` keys `restaurant_name/address/phone/email`, receipt footer; seeds in `lib/db/sqlite-seed.js`, `scripts/seed-postgres.mjs` | Set Dim Sum Puri identity (editable, not hard-coded). |
| Receipts | `lib/print-receipt.js` (58/80mm thermal) | Update identity only; preserve layout. |

## Deployment profile (feature flags — planned)

Adapt to existing config pattern (`system_settings`); proposed keys:

```
restaurant_mode = COUNTER_READY_SERVE
enabled_roles   = ["ADMIN"]
feature.waiterWorkflow        = false
feature.kitchenDisplay        = false
feature.kitchenTicket         = false
feature.requiredTableAssignment = false
feature.staffRoleLogin        = false
```

Legacy roles/tables are **preserved** (data integrity) but hidden via config, nav, route guards, and permissions — reversible.

## Open findings (require decision / later fix)

1. ~~**Counter sale does not post an accounting journal.**~~ **FIXED & VERIFIED.**
   `/api/admin/billing` now calls `ensureAccountingSchema` then `postSaleJournal`
   inside the sale transaction (idempotent per bill via `source_type='bill'`).
   Verified on **both** SQLite dev and the live Postgres DB: a completed sale
   posts one balanced journal — Dr payment account (e.g. Cash 1010) / Cr Sales
   Revenue 4010 — exactly once alongside order/bill/payment/stock.
   (`db.transaction` is atomic on Postgres too via `pgTxStore` AsyncLocalStorage.)
2. **Seed vs existing data.** Identity/tax default changes apply to *fresh*
   seeds only. Existing databases keep their stored `system_settings`; update
   those rows explicitly (done for the local dev DB).

## Phase status

- [x] **Phase 1** — Audit & impact map (this document); baseline recorded.
- [x] **Phase 3** — Menu import from `Menu.xlsx` (idempotent script + `menu-import-report.md`). 103 items / 13 groups / 3 variants verified; legacy items/categories hidden (not deleted).
- [x] **Phase 2** — Single-admin counter workflow. `lib/deployment.js` feature flags; single-admin login (no staff picker); admin lands on New Sale (`/admin/billing`); non-admin rejected at login; legacy `/waiter /kitchen /cashier` redirected server-side (middleware); nav pruned; dashboard table/waiter/reservation widgets gated; identity + editable 0% tax defaults; brand assets wired; **counter sale posts accounting journal (fixed & verified on Postgres)**. Verified in browser: login → counter POS with live menu; sale posts order/bill/payment/journal once.
  - **Postgres deployment live:** DB `dimsumpuri` created, 23 migrations applied, admin seeded, 103 menu items imported. Local `.env` (gitignored) holds `DATABASE_URL`.
- [x] **Phase 4** — Public website. New Next public site (route group `app/(public)`): Home, About, Gallery, Contact + rebranded `/menu`; shared `PublicShell` (nav + Call/WhatsApp footer); `lib/restaurant-info.js` + `lib/public-gallery.js`; brand tokens in `globals.css` (`.dsp-site`); Fraunces/Manrope fonts; logo + storefront + 32 mapped food photos (`scripts/map-menu-images.mjs`); live menu preview + `/menu` from the same DB; lazy Google map embed + Open-in-Maps; FB/TikTok links; LocalBusiness JSON-LD (verified fields only, no rating/hours). `/` no longer rewrites to `sundar.html`. Verified in browser: home renders with live prices, no console errors, no 375px overflow, images lazy-load.
- [~] **Phase 5** — Source verification. `content-sources.md` written (facts, confidence, omissions, to-confirm list). Scraping declined per policy/brief. Remaining: client confirmations (FB handle, hours, spellings).
- [x] **Phase 6** — Visual system. Brand tokens (`.dsp-site`) + Fraunces/Manrope applied. Impeccable `polish` pass: removed banned eyebrows/kickers site-wide, reworked the three-identical-cards block into a composed "How it works" band, tailored MenuBook hero copy (was "Crafted with Passion"). Impeccable mechanical detector returns clean (`[]`); no console errors; no 375px overflow. (emil-design-eng motion left restrained per craft floor — no gratuitous animation.)
- [ ] **Phase 7** — Testing & acceptance (Playwright suite pending; extensive manual browser verification done).
