# Dim Sum Puri POS — Implementation Handoff

Conversion of the AADHAR/Sundar restaurant POS into **Dim Sum Puri Fastfood
Restaurant** (Birendranagar-6, New Road, Surkhet). Counter-service, single-admin.

## 1. Summary of implemented changes

- **Single-admin counter workflow** (Phase 2): clean Administrator login (no
  staff picker), admin lands directly on the **New Sale** counter POS
  (`/admin/billing`), legacy waiter/kitchen/cashier roles disabled by config and
  their routes redirected server-side. A completed counter sale now posts a
  balanced double-entry **accounting journal** (was missing) — verified on
  Postgres.
- **Menu import** (Phase 3): the client `Menu.xlsx` is imported idempotently —
  **103 items / 13 groups / 3 variants** — into the same DB the POS and public
  site read.
- **Public website** (Phase 4): new Next site (Home, Menu, About, Gallery,
  Contact) with live menu prices, logo/storefront/food photos, Call / WhatsApp /
  Directions, lazy Google-map embed, and LocalBusiness structured data.
- **Visual system** (Phase 6): warm brand tokens + Fraunces/Manrope, polished
  with the Impeccable skill (removed generic kickers, reworked card-stacks).
- **Tests** (Phase 7): Playwright suite, 18 tests passing (desktop + mobile).

## 2. Files / modules changed (key)

| Area | Files |
|------|-------|
| Deployment profile | `lib/deployment.js` (new) |
| Auth / login | `app/login/page.jsx`, `lib/auth-context.jsx`, `middleware.js` |
| Admin nav / dashboard | `components/admin/admin-layout.jsx`, `app/admin/dashboard/page.jsx` |
| Counter sale + accounting | `app/api/admin/billing/route.js`, `components/billing/walk-in-billing.jsx` |
| Settings / identity | `app/api/admin/settings/route.js`, `lib/db/sqlite-seed.js`, `scripts/seed-postgres.mjs` |
| Menu import | `scripts/menu/extract_grid.py`, `scripts/import-menu.mjs`, `scripts/map-menu-images.mjs`, `data/menu/*` |
| Public site | `app/(public)/*`, `components/public/public-shell.jsx`, `lib/restaurant-info.js`, `lib/public-gallery.js`, `app/menu/page.jsx`, `app/globals.css` (`.dsp-site`), `app/layout.js` |
| Tests | `playwright.config.js`, `tests/e2e/*` |

## 3. Database migrations & recovery

- **New column:** `menu_items.source_ref` (nullable TEXT) — stable idempotency
  key added defensively by `scripts/import-menu.mjs` (and safe on re-run).
  Rollback: `ALTER TABLE menu_items DROP COLUMN source_ref;` (data-safe).
- **No destructive migrations.** Legacy demo menu items/categories are
  **hidden** (`is_available=0` / `is_active=0`), never deleted.
- Postgres provisioned locally: DB `dimsumpuri`, all 23 migrations applied via
  `npm run db:migrate`, admin seeded, menu imported.
- Re-import is idempotent: `npm run import:menu -- --deactivate-unmanaged`.

## 4. Feature flags / deployment config

`lib/deployment.js` — default is now `RESTAURANT_MODE=FULL_SERVICE`:
`ENABLED_ROLES=['admin','waiter','kitchen','cashier']` (admin always included),
`FEATURES` (waiterWorkflow, kitchenDisplay, kitchenTicket,
requiredTableAssignment, staffRoleLogin, reservations — all on). Set
`RESTAURANT_MODE=COUNTER_READY_SERVE` to go back to single-admin/counter-only.
Env overrides: `RESTAURANT_MODE`, `POS_ENABLED_ROLES` (e.g. `admin,cashier`).

## 5. Menu import totals / variants / warnings

- 103 items, 13 groups; see `menu-import-report.md`.
- Variants: Mutton Shadeko (Boiled 300 / Fried 320), Chicken Shadeko (280 / 300),
  Sausage (Fried 260 / Boiled 270).
- Assumption: the unlabelled beverage block is grouped as **"Cold Beverages"** —
  confirm the name.
- Spelling suggestions flagged (not applied): Nascoffe→Nescafé, Lamonade,
  Burgar, Draigon, Saussage, Thupka→Thukpa, etc.

## 6. Verified business-source log

See `content-sources.md` — every public fact, its source, and confidence, plus
the deliberately omitted (hours, ratings) and the to-confirm list (notably the
Facebook handle `BhansaGreenCafe` which does not match the name).

## 7. Tests run

- **Playwright E2E: 18/18 passing** (`npm run test:e2e`) — admin login, counter
  loads with menu, variant item present, wrong-password rejection, public home
  (CTAs + WhatsApp number + live prices), menu prices, mobile no-overflow, legacy
  role redirect, about/gallery/contact.
- **Build:** `SKIP_DB_ON_BUILD=1 npm run build` passes.
- **Lint:** 32 pre-existing errors / 42 warnings (baseline); **no new** lint
  issues introduced by this work (verified per changed file).
- **Accounting integrity:** counter sale posts order+bill+payment+journal once;
  balanced Dr Cash / Cr Sales — verified on Postgres.

## 8. Before/after screenshots

Verified live via browser automation (login → counter, public home desktop +
375px mobile, `/menu`). Static screenshots not captured to files in this
environment; the running dev server reproduces every checked state.

## 9. Manual configuration still required

- Change the admin password (dev seed forces a change on first login).
- Confirm the **Facebook** page URL, **opening hours**, postal code, and menu
  **spelling** corrections.
- Replace the generic food-image pack with real photos, then re-run
  `node scripts/map-menu-images.mjs`.
- Set **VAT/PAN** status and tax rate in Settings (currently editable, 0%).
- Add payment **QR** images in Settings for the counter QR payment option.
- Production `DATABASE_URL`, secrets, and admin creation (never hard-coded).

## Running locally

```bash
# Postgres-backed dev server (identity/menu already seeded in DB "dimsumpuri")
DATABASE_URL=postgresql://postgres:root@localhost:5432/dimsumpuri npx next dev -p 3002
# then: http://localhost:3002 (public)  ·  /login  admin / <your password>
npm run test:e2e     # requires the dev server running on :3002
```
