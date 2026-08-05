# Application and User Flows

## 1. Surface map

| Surface | Entry | Main destination |
|---|---|---|
| Public site | `/` | Marketing, contact, reservation/inquiry links |
| Public menu | `/menu` | Current available menu |
| Table self-order | `/order/[token]` | Token-bound table cart and order status |
| Staff login | `/login` | Role landing page |
| Waiter | `/waiter` | Tables, order entry, history, reservations, dashboard |
| Kitchen | `/kitchen` | KOT queue and item/order status |
| Cashier | `/cashier` | Console, billing, receipts, payment history, reports |
| Admin | `/admin` | Operations, configuration, inventory, people, accounting, reports |

## 2. Authentication flow

1. Client requests active login users and submits username plus PIN/password.
2. Server rate-limits attempts, verifies an active user and bcrypt credential.
3. Server creates an expiring session and returns the user plus session/CSRF state.
4. Client routes by role: admin, cashier, waiter, or kitchen.
5. Every protected API verifies the session and role/permission; mutations using cookie auth also verify CSRF.
6. Logout deletes/inactivates the server session and clears cookies.

Failure paths: bad credential, inactive employee, rate limit, expired session, missing CSRF, forbidden role, and database unavailable.

## 3. Dine-in order-to-cash flow

1. Waiter selects an available table or creates a suitable order.
2. Order is created with server-priced menu items and waiter attribution; table becomes occupied.
3. Additional items may be added while business rules allow.
4. KOT is sent; kitchen sees the ticket and progresses pending → preparing → ready.
5. Waiter marks/observes service progress.
6. Cashier opens the order, reviews subtotal, configured VAT/service, and any authorized discount.
7. Cashier chooses one or more payment tenders. Cash handling shows tendered amount/change; non-cash methods record reference where required.
8. Server atomically creates/updates the bill, payment rows, sale journal, order state, and table availability.
9. Receipt is shown/printed using configured business details and paper size.

Critical invariants: one paid bill per order, sum of tenders equals collectible amount, no half-posted journal, stock is not deducted twice, and table release occurs only at the correct terminal state.

## 4. Customer QR order flow

1. Customer scans a table-specific QR code.
2. GET by token verifies the table and QR-ordering setting, then returns allowed menu/order state.
3. Customer builds a cart and submits item IDs, quantities, and notes.
4. Server rejects invalid/unavailable items and recalculates prices; it creates or appends to the table order.
5. KOT/kitchen and staff flows continue through the same order system.
6. Customer can refresh status but cannot access another table through an invalid token.

## 5. Reservation-to-table flow

1. Customer submits a reservation; server validates, rate-limits, and stores it as a web lead/new reservation.
2. Host/admin reviews and confirms, rejects/cancels, or updates details.
3. Timing rules use hold, grace, dining, cleaning, auto-cancel, and minimum-lead settings.
4. Host assigns a compatible available table, checks in, and seats the party; customer/order linkage is retained.
5. Table may be changed under conflict rules.
6. Paying the linked seated order completes the visit/reservation; table proceeds to the correct available/cleaning state.

## 6. Inventory and procurement flow

1. Admin defines inventory categories, base units, and optional conversions.
2. Supplier and purchase are recorded with lines, quantities, unit cost, and payment basis.
3. Receipt increases stock and records stock movements/moving cost.
4. Cash/bank purchase posts the asset/expense and cash/bank journal; credit purchase posts supplier payable.
5. Recipe links menu output to ingredient quantities and determines expected cost.
6. Order fulfillment deducts recipe stock according to the implementation trigger; cancellation/correction restores only when defined and never twice.
7. Adjustment/restock/wastage creates traceable movements; wastage also posts the loss journal.

## 7. Cash and accounting flow

1. Open a cash drawer with opening float.
2. Sales, purchases, expenses, payroll, settlements, transfers, and corrections post balanced journal entries with source references.
3. Cashier closes/reconciles the drawer; expected vs counted variance is visible and recorded.
4. Bank deposits, withdrawals, and transfers affect the selected accounts once.
5. Supplier credit and subsequent payment reconcile through the AP sub-ledger.
6. Bank reconciliation marks appropriate journal lines without changing the underlying transaction amount.
7. Trial balance, P&L, balance sheet, cash/bank books, and finance dashboard derive from the same journal lines.

## 8. Release/update flow

1. Back up PostgreSQL and persistent uploads; record release/build identifier.
2. Deploy code and install locked dependencies.
3. Apply forward-only migrations, build, and restart the Node application.
4. Run health, migration, authentication, order-to-payment, accounting, upload, and public smoke tests.
5. Monitor logs and business metrics; roll back code or restore data only under the approved rollback decision in `DEPLOYMENT_GUIDE.md`.

