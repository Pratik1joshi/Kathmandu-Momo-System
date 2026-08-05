# Product Requirements Document

## 1. Product summary

Kathmandu Momo System is a single-restaurant operations platform for Kathmandu Momo, Birendranagar, Surkhet. One Next.js application provides the public website and menu, reservations and table QR ordering, staff POS workflows, kitchen operations, cashier billing, inventory, purchasing, employees, and double-entry accounting.

## 2. Goals

- Run dine-in service from table assignment through paid receipt without parallel paper records.
- Give kitchen staff a clear, timely KOT queue and status workflow.
- Produce correct bills, payments, inventory movements, and balanced financial journals.
- Let management configure menu, staff permissions, restaurant settings, inventory, and reports.
- Provide customers a mobile-friendly public site, current menu, reservation form, and secure table QR ordering.
- Operate safely on cPanel with Node.js 22 and PostgreSQL, including backup and recovery.

## 3. Non-goals for the current release

- Multi-branch or multi-tenant operation.
- Third-party delivery marketplace integration.
- Native iOS/Android applications.
- Offline-first synchronization between terminals.
- Direct payment-gateway capture or automated bank feeds.
- Government fiscal-device integration.

Legacy multi-shop/distribution endpoints remain intentionally disabled and must return HTTP 410.

## 4. Users and permissions

| Persona | Primary needs | Expected access |
|---|---|---|
| Customer | View business/menu, inquire, reserve, order from table QR | Public surfaces only |
| Waiter | View tables/reservations, create and update orders, send KOT, serve items | Operational access; no payment by default |
| Kitchen | View KOT queue, start/complete items, log wastage | Kitchen operations only |
| Cashier | Create/review orders, bill, split/take payments, print, reports | Cashier workflow and configured permissions |
| Admin/owner | Full configuration, operations, people, inventory, accounting, reporting | Full access |

Admin always receives all configurable permissions. Waiter and cashier defaults and overrides are defined by `lib/permissions.js` and stored in `system_settings.role_permissions`.

## 5. Functional requirements

### Public experience

- `/` presents Kathmandu Momo branding, location/contact details, calls to action, inquiry and reservation entry points.
- `/menu` displays only available menu data and usable images.
- Public inquiry and reservation submissions validate required fields, resist abuse, and return friendly errors.
- `/order/[token]` accepts only a valid table QR token and respects the `qr_ordering_enabled` setting.
- Public order prices and availability are always recalculated on the server.

### Authentication and staff access

- Active staff authenticate at `/login` using username and PIN/password.
- A successful login creates an expiring server session; logout invalidates it.
- Protected APIs reject missing/expired sessions with 401 and forbidden roles/actions with 403.
- Admin can manage employees, reset PINs, and configure waiter/cashier permissions.

### Tables, reservations, and customers

- Admin manages floors, table types, tables, capacity, and QR codes.
- Waiter/host sees reservation timing, assigns or changes tables, seats and completes reservations.
- Table state remains consistent with active orders, payment, transfer, merge, cleaning, and reservation state.
- Customer records retain useful contact and sales history without exposing data publicly.

### Menu, ordering, kitchen, and billing

- Admin manages categories, menu items, price, availability, diet marker, images, and variants where supported.
- Waiter/cashier/customer can create valid orders and append valid items.
- KOT submission appears on the kitchen board; item/order timing and status changes remain consistent.
- Billing applies configured VAT, service charge, and authorized discount correctly.
- Payment supports configured cash/non-cash methods, split tender, references, change, and printable 58/80mm receipts.
- A completed payment cannot be duplicated; reopening, voiding, and refunding require authorization and an audit reason.

### Inventory and purchasing

- Inventory items support category, base unit, cost, current quantity, minimum stock, adjustments, and history.
- Unit conversions preserve quantities across purchase and recipe units.
- Recipes define bill-of-material consumption and calculated cost/margin.
- Purchases add stock and post the appropriate cash, bank, or supplier-payable accounting entry.
- Wastage reduces stock and records reason, employee/shift context, and accounting impact.

### People, reporting, and accounting

- Admin manages employee profile, role, status, salary, hire date, and payroll history.
- Reports honor date boundaries and reconcile to source orders/bills/payments.
- Every financial event posts one balanced journal; balances are derived from journal lines.
- Chart of accounts, general ledger, cash/bank books, drawer, settlement, payable, correction, reconciliation, P&L, balance sheet, and trial balance views remain internally consistent.

### Settings and operations

- Admin configures business identity, VAT/PAN, tax/service percentages, reservation timers, receipt format/footer, QR ordering, and payment QR details.
- Uploads validate file type/size, use a persistent directory, and are served without exposing filesystem paths.
- `/api/health` reports application/database health without disclosing secrets.

## 6. Quality attributes

- Correctness: no duplicate paid bill; monetary totals and balanced journals are deterministic.
- Security: HTTPS, secure session cookies, CSRF for cookie-authenticated mutation, role/permission enforcement, rate limits, safe errors.
- Reliability: atomic business transactions, graceful shutdown, migration tracking, tested backup restoration.
- Usability: responsive touch targets and clear loading, empty, success, validation, and error states.
- Compatibility: current Chrome/Edge desktop; current Chrome/Safari mobile; thermal print layouts at 58mm and 80mm.
- Performance targets on production-like data: public/menu p95 under 2.5s, staff navigation/API p95 under 2s, mutation p95 under 3s, no unbounded request storms.

## 7. Release acceptance

A release is production-ready only when the required cases in `QA_CHECKLIST.md` pass, no open Severity 1 or 2 defects remain, financial reconciliation and restore drills pass, and product/operations/engineering/QA sign the `LAUNCH_CHECKLIST.md` decision.

