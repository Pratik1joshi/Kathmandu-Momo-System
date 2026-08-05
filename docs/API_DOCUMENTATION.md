# API Documentation

This is the repository-level API catalog for QA and maintainers. The implementation in `app/api/**/route.js` is authoritative for exact request fields. The OpenAPI specification is not currently generated.

## 1. Conventions

Base URL is `APP_URL`. JSON requests use `Content-Type: application/json`; file uploads use multipart form data. Query parameters are used for search, status, IDs, pagination, and date ranges as implemented.

### Authentication

- Staff login: `POST /api/auth/login`.
- Session verification: `GET /api/auth/verify`.
- Logout: `POST /api/auth/logout`.
- Protected calls accept the application session token. Cookie sessions use `pos_session`; mutation requests also send the `pos_csrf` value as `x-csrf-token`. The SPA bearer path sends `Authorization: Bearer <session>`.
- Admin routes require admin unless the route explicitly supports another authorized role. Restaurant routes require an authenticated operational role and may check a fine-grained action.

### Response/status expectations

| Status | Meaning |
|---|---|
| 200/201 | Successful read/create/update |
| 400/422 | Invalid input or business rule failure |
| 401 | Missing, invalid, or expired session |
| 403 | Authenticated but role/action/CSRF forbidden |
| 404 | Resource or QR token not found |
| 409 | State/concurrency/uniqueness conflict where supported |
| 429 | Rate limit exceeded; honor `Retry-After` when present |
| 410 | Removed legacy endpoint |
| 500 | Safe generic unexpected error; no internal details |

## 2. Public and platform endpoints

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/health` | GET | Application/database health |
| `/api/public/menu` | GET | Available public menu |
| `/api/public/reservations` | POST | Rate-limited public reservation |
| `/api/public/inquiries` | POST | Rate-limited contact inquiry |
| `/api/public/order/[token]` | GET, POST | Token-bound table menu/order state and submit/append order |
| `/api/media/[...path]` | GET | Safely serve allowed persistent uploads |

Public POST testing must cover malformed JSON, required fields, length/format bounds, rate limiting, injection strings, repeated submission, and safe errors.

## 3. Staff/auth compatibility endpoints

| Endpoint | Methods | Notes |
|---|---|---|
| `/api/users/active` | GET | Login picker data; verify it exposes only intended fields |
| `/api/permissions` | GET | Effective permission map for signed-in user |
| `/api/uploads/menu` | POST | Authorized menu image upload |
| `/api/uploads/receipts` | POST | Authorized receipt image upload |

The compatibility endpoints `/api/admin/login`, `/api/shop/login`, `/api/shop/sync`, `/api/products`, `/api/orders`, `/api/customers`, `/api/ingredients`, `/api/held-bills`, `/api/credit-payments`, and `/api/transactions` are legacy/disabled surfaces. QA must confirm each method returns 410 and cannot mutate data.

## 4. Restaurant operations API

| Resource | Endpoint(s) | Methods |
|---|---|---|
| Menu | `/api/restaurant/menu` | GET, POST, PATCH, DELETE |
| Menu categories | `/api/restaurant/menu/categories` | GET, POST, PUT, DELETE |
| Tables | `/api/restaurant/tables`, `/api/restaurant/tables/[id]` | GET, PATCH; GET by ID |
| Transfer/merge | `/api/restaurant/tables/transfer`, `/api/restaurant/tables/merge` | POST |
| Orders | `/api/restaurant/orders`, `/api/restaurant/orders/[id]` | GET, POST, PATCH; GET, PUT, DELETE by ID |
| Order items | `/api/restaurant/orders/[id]/items`, `/api/restaurant/order-items/[id]/status` | POST, PATCH; PUT status |
| Order history/print | `/api/restaurant/orders/history`, `/api/restaurant/orders/[id]/print-bill` | GET; POST |
| KOT | `/api/restaurant/kots`, `/api/restaurant/kots/[id]` | GET, POST, PATCH; GET, PUT, PATCH by ID |
| Bills | `/api/restaurant/bills` | GET, POST, PATCH |
| Payment/reopen | `/api/restaurant/bills/[id]/payment`, `/api/restaurant/bills/reopen` | POST |
| Payments | `/api/restaurant/payments` | GET |
| Reservations | `/api/restaurant/reservations`, `/api/restaurant/reservations/[id]` | GET; PATCH by ID |
| Waiter stats | `/api/restaurant/waiter/stats` | GET |

For every mutation test a valid case, boundary input, missing resource, stale/terminal state, unauthorized role, denied configurable permission, repeated request, and concurrent request.

## 5. Admin operations API

| Domain | Endpoint(s) | Methods/purpose |
|---|---|---|
| Dashboard/reports | `/api/admin/dashboard`, `/reports`, `/kitchen-analytics`, `/employee-performance` | GET analytics with filters |
| Orders/billing | `/api/admin/orders`, `/orders/[id]`, `/billing` | GET/PUT, GET detail, POST billing |
| Products | `/api/admin/products`, `/products/[id]` | GET/POST, PUT/DELETE |
| Inventory | `/api/admin/inventory`, `/inventory/[id]`, `/inventory/restock`, `/inventory/import` | CRUD, PATCH detail, restock/import POST |
| Inventory taxonomy | `/api/admin/inventory-categories`, `/unit-conversions` | GET/POST/PUT/DELETE |
| Stock | `/api/admin/stock`, `/stock-movements` | CRUD stock, GET ledger |
| Recipes | `/api/admin/recipes` | GET/POST/PUT/DELETE |
| Purchases | `/api/admin/purchases`, `/purchases/[id]`, `/purchases/import` | GET/POST; detail GET/PUT/DELETE; import POST |
| Suppliers/AP | `/api/admin/suppliers`, `/accounts-payable` | Supplier operations; payable GET/POST |
| Expenses | `/api/admin/expenses`, `/expense-categories` | GET/POST/PUT/DELETE |
| Wastage | `/api/admin/wastage` | GET/POST |
| Employees | `/api/admin/employees`, `/employees/[id]`, `/employees/[id]/pin`, `/payroll` | Staff CRUD, status/detail, PIN, payroll |
| Customers | `/api/admin/customers` | GET/POST/PUT/DELETE |
| Tables | `/api/admin/tables`, `/table-floors`, `/table-types`, `/table-qr` | Roster/taxonomy CRUD and QR generation/rotation |
| Reservations | `/api/admin/reservations` and `[id]` routes | List/create/update/detail, seat, change table, alerts |
| Leads/inquiries | `/api/admin/leads/counts`, `/inquiries` | Counts; inquiry GET/PATCH |
| Settings/permissions | `/api/admin/settings`, `/permissions` | GET/PUT |

## 6. Accounting API

| Endpoint | Methods | Key verification |
|---|---|---|
| `/api/admin/accounts` | GET, POST, PUT, DELETE | Account constraints and protected/system accounts |
| `/api/admin/ledger` | GET | Date/account filters and source traceability |
| `/api/admin/finance-dashboard` | GET | Reconcile summary to ledger |
| `/api/admin/financial-reports` | GET | Trial balance, P&L, balance sheet cutoffs |
| `/api/admin/cash-drawer` | GET, POST, PUT | Open, activity, close/reconcile |
| `/api/admin/bank` | GET, POST | Account and bank operations |
| `/api/admin/bank-reconciliation` | GET, POST | Match/unmatch/reconciliation |
| `/api/admin/cash-exchange` | GET, POST | Cash/bank exchange |
| `/api/admin/settlements` | GET, POST | Payment-method settlement |
| `/api/admin/corrections` | GET, POST | Void/refund/reversal with reason |

Every successful accounting mutation must create balanced lines once, retain a source reference, and reconcile to its source record. Test rollback by forcing an invalid dependent write in an isolated QA database.

## 7. Upload contract

Upload routes must require authentication/authorization, accept only configured image MIME types/extensions, enforce size limits, generate safe names, reject traversal and polyglot/non-image payloads, and store under `UPLOADS_DIR`. Media GET must prevent `..`, encoded traversal, absolute path, and unintended file access.

## 8. Maintaining this catalog

When adding/removing a route, update this document and `QA_CHECKLIST.md`. Before release, compare this catalog with:

```powershell
rg --files app\api | Where-Object { $_ -match 'route\.(js|ts)$' } | Sort-Object
rg -n "export async function (GET|POST|PUT|PATCH|DELETE)" app\api
```

