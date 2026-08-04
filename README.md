# Kathmandu Momo — Restaurant POS

Point-of-sale, kitchen, billing, inventory and accounting for **Kathmandu Momo**,
Birendranagar, Surkhet — plus the public marketing site, live menu and online
reservations, all from one Next.js app.

## Quick start (local)

```bash
npm install
npm run dev
```

Dev server: **http://localhost:3002**

Local development uses SQLite (`better-sqlite3`) with a demo seed. Production
runs on PostgreSQL — see [deploy/INSTALL.md](deploy/INSTALL.md).

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Public | Marketing landing page (`public/kathmandu-momo.html`) |
| `/menu` | Public | Live menu, straight from the POS |
| `/order/[token]` | Public | QR table ordering |
| `/login` | Staff | PIN login |
| `/waiter` | Waiter | Tables, orders, reservations |
| `/kitchen` | Kitchen | KOT display |
| `/cashier` | Cashier | Billing, payments, receipts |
| `/admin` | Admin | Menu, inventory, purchases, payroll, accounting, reports |

## Database

```bash
npm run db:migrate      # incremental migrations (Postgres)
npm run db:seed         # admin user + system settings + baseline tables
npm run db:pg:init      # migrate + seed in one go
npm run health          # connectivity / schema check
```

Production install (schema, seed, menu pack, cPanel setup):
**[deploy/INSTALL.md](deploy/INSTALL.md)**

Seed files:

| File | Contents |
|---|---|
| `deploy/production_schema.sql` | All tables, indexes, constraints |
| `deploy/production_seed.sql` | Chart of Accounts, cash drawer, bank, **Kathmandu Momo settings**, first admin |
| `deploy/menu-pack/seed_menu.sql` | Menu categories + items + image URLs |
| `deploy/default_seed.sql` | Floors, table types, unit conversions, inventory, recipes |

Run order: `production_schema` → `production_seed` → `seed_menu` → `default_seed`.

## Branding

Everything customer-facing is in a handful of places:

| What | Where |
|---|---|
| Landing page | `public/kathmandu-momo.html` (served at `/` via `middleware.js` + `next.config.mjs`) |
| Photography | `public/images/kathmandu-momo/` — see the README in that folder |
| Icons / favicon | `npm run build:icons` regenerates them from `scripts/build-brand-icons.mjs` |
| Browser title, SEO, Open Graph | `app/layout.js` |
| PWA name | `app/manifest.js` |
| Receipt header / footer | Admin → Settings (seeded by `deploy/production_seed.sql`) |
| Menu page header | `components/menu-book/menu-book.jsx` |

Receipts, bills and KOTs read the business name, address, phone and footer from
**system settings** — change them in Admin → Settings, not in code.

## Tech

- **Framework**: Next.js 16 (App Router), React 19
- **UI**: TailwindCSS 4, Radix UI, lucide-react
- **Database**: PostgreSQL in production, SQLite locally
- **Auth**: PIN login, bcrypt hashes, HTTP-only sessions, CSRF tokens
- **Printing**: shared thermal receipt system, 58mm / 80mm (`lib/print-receipt.js`)

## Scripts

```bash
npm run dev             # dev server (port 3002)
npm run build           # production build
npm run start           # production server (server.js)
npm run lint            # eslint
npm run build:menu-pack # rebuild deploy/menu-pack (images + seed SQL)
npm run build:icons     # regenerate the KM monogram icons
```

## Docs

- [deploy/INSTALL.md](deploy/INSTALL.md) — production install
- [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) — modules and data flow
- [docs/CPANEL_DEPLOYMENT.md](docs/CPANEL_DEPLOYMENT.md) — cPanel specifics
- [docs/PRODUCTION_AUDIT.md](docs/PRODUCTION_AUDIT.md) — security / readiness audit

## Default login

`admin` / PIN `1234` — **change it on first sign-in.**
