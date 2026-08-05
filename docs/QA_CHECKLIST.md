# Full Website QA and Production-Readiness Guide

This is the executable QA plan for the whole Kathmandu Momo System. It covers public pages, every staff role, all functional modules, APIs, data, security, accounting, deployment, recovery, performance, accessibility, printing, and launch sign-off.

## Website and WhatsApp ordering production gate

- [ ] Cart add/update/remove works on desktop and mobile; estimate matches live POS prices.
- [ ] Website submit creates one `PENDING`/`UNPAID` request and no KOT, invoice, journal, or stock movement.
- [ ] Double-click/retry returns the stable reference without duplication.
- [ ] WhatsApp request saves before the encoded message opens; closing WhatsApp leaves it pending.
- [ ] The message includes reference, customer, fulfillment, items, notes, and server total.
- [ ] Accepting rapidly twice creates exactly one operational order and one KOT.
- [ ] Price/availability changes between submit and accept stop acceptance safely.
- [ ] Reject/cancel without a reason fails; rejection creates no KOT.
- [ ] Kitchen cannot access the queue or customer/payment details; accepted KOT appears once.
- [ ] Existing cashier payment changes the linked request to `COMPLETED`/`PAID` exactly once.
- [ ] Status token is non-guessable and exposes no phone/address/payment secrets.
- [ ] Admin and Cashier queues work at 360px, tablet, and desktop widths.

## 1. How QA should use this guide

Run the checklist on a production-like **staging PostgreSQL database**, then repeat the P0 smoke set on production after deployment. Do not test destructive cases using live restaurant data.

For every case record:

| Field | Required evidence |
|---|---|
| Case ID/result | Pass, Fail, Blocked, or Not Applicable |
| Build/environment | Commit/tag, URL, browser/device, DB snapshot |
| Actor/data | Role, test user, source IDs/numbers, relevant settings |
| Actual result | UI/API status and persisted result |
| Evidence | Screenshot/video, request/response, safe log excerpt, DB query |
| Defect | Ticket, severity, owner, retest result |

Never paste secrets, session tokens, real passwords, sensitive customer data, or unsanitized production dumps into evidence.

### Severity and release policy

| Severity | Definition | Release rule |
|---|---|---|
| S1 Critical | Data loss/corruption, security compromise, wrong/duplicate payment, unbalanced accounts, system unavailable | No-go |
| S2 High | Core order/KOT/billing/stock/role flow unavailable or materially incorrect; no safe workaround | No-go |
| S3 Medium | Non-core failure or safe workaround; limited user/business impact | Written risk acceptance |
| S4 Low | Cosmetic/content/minor usability issue | May defer with owner/date |

All P0 and required P1 cases must pass. No open S1/S2 is allowed.

## 2. Environment, accounts, and test data

### QA-ENV

- [ ] QA-ENV-01 — Staging matches production Node 22, Next production build, proxy/HTTPS, PostgreSQL version/config, environment variables, and uploads behavior.
- [ ] QA-ENV-02 — Release build came from `npm ci` and `npm run build`; commit/tag is recorded.
- [ ] QA-ENV-03 — `npm run db:migrate` succeeds; rerunning does not reapply migrations; all `001`–`025` records exist.
- [ ] QA-ENV-04 — `/api/health` returns 200/database up and no secret, host path, SQL, or unnecessary version detail.
- [ ] QA-ENV-05 — Database is confirmed PostgreSQL, not SQLite fallback.
- [ ] QA-ENV-06 — `UPLOADS_DIR` is persistent/writable and survives restart/redeploy.
- [ ] QA-ENV-07 — Logs, timezone (`Asia/Katmandu` behavior), clock/NTP, and business date are correct.
- [ ] QA-ENV-08 — Four active accounts exist (admin, waiter, kitchen, cashier), plus an inactive and a permission-restricted account.
- [ ] QA-ENV-09 — Test data includes multiple floors/types/tables; valid/rotated QR tokens; available/unavailable menu items; variants; inventory with low/zero stock; conversions; recipes; suppliers; customers; reservations; open/closed drawer; cash/bank accounts.
- [ ] QA-ENV-10 — Browser/device matrix: current Chrome and Edge desktop; current Android Chrome; current iPhone Safari or responsive-equivalent plus at least one real iPhone pass; actual POS printer.

## 3. P0 release smoke journey

Execute in order after each deployment. Stop and declare no-go on data corruption or security leakage.

- [ ] QA-P0-01 — Open `/`, `/menu`, `/login`, and `/api/health` over HTTPS; no broken critical asset or console-blocking error.
- [ ] QA-P0-02 — Log in once as admin, waiter, kitchen, and cashier; each reaches the correct surface and cannot open a forbidden admin page/API.
- [ ] QA-P0-03 — Waiter selects a table, creates an order with two items and notes, sends KOT; one order/KOT and correct lines exist.
- [ ] QA-P0-04 — Kitchen sees that KOT, starts it, marks items/order ready; waiter observes correct state and non-negative timing.
- [ ] QA-P0-05 — Cashier bills it with configured VAT/service and a controlled discount; totals match independent calculation.
- [ ] QA-P0-06 — Complete a split payment; payment sum, change/reference, bill/order state, receipt, table release, and payment history agree.
- [ ] QA-P0-07 — Verify only one paid bill, one sale accounting source, balanced journal, intended recipe stock deduction, and matching reports.
- [ ] QA-P0-08 — Submit a public reservation and process it at host/waiter; scan a valid table QR and submit an order.
- [ ] QA-P0-09 — Upload one menu image, view it publicly, restart app, and view it again.
- [ ] QA-P0-10 — Trigger a safe validation error and a controlled server error; response/log must not expose stack, SQL, path, cookie, or token.

## 4. Public website and customer experience

### QA-PUB — Landing page `/`

- [ ] QA-PUB-01 — Correct Kathmandu Momo name, logo, address, phone, hours, map/contact links, navigation, and calls to action.
- [ ] QA-PUB-02 — All sections, gallery/dish images, icons, fonts, favicon, title, meta description, canonical/social preview values are correct.
- [ ] QA-PUB-03 — Internal anchors and links work; phone/email/map/external links use correct targets and safe new-tab behavior.
- [ ] QA-PUB-04 — Inquiry form validates required/format/length bounds, prevents accidental duplicate submit, gives success/error feedback, and creates one admin inquiry.
- [ ] QA-PUB-05 — Reservation entry validates past date, minimum lead, party size, phone, whitespace, Unicode/Nepali text, and creates one reservation.
- [ ] QA-PUB-06 — Forms fail gracefully under offline/timeout/429/500 and preserve safe user input for retry.
- [ ] QA-PUB-07 — Responsive at 320, 375, 768, 1024, and 1440px with no horizontal overflow or hidden control.
- [ ] QA-PUB-08 — No mixed content, broken resource, unexpected third-party request, serious console error, or layout shift.

### QA-MENU — Public menu `/menu`

- [ ] QA-MENU-01 — Categories/order/counts and available items match admin/database; unavailable/deleted items are absent.
- [ ] QA-MENU-02 — Name, description, price/currency, diet marker, image/fallback, and variants display correctly.
- [ ] QA-MENU-03 — Search/filter/navigation and empty/no-image/long-text/many-items states work.
- [ ] QA-MENU-04 — Admin availability/price/image update appears after intended refresh/cache behavior.
- [ ] QA-MENU-05 — Mobile touch/scroll and slow-image behavior remain usable and accessible.

### QA-QR — Table QR `/order/[token]`

- [ ] QA-QR-01 — Valid token identifies only the correct table and returns current allowed menu/order state.
- [ ] QA-QR-02 — Unknown, malformed, missing, old rotated, and other-table token fail safely without data disclosure.
- [ ] QA-QR-03 — Turning `qr_ordering_enabled` off blocks order placement with useful UX; re-enable restores it.
- [ ] QA-QR-04 — Add/update/remove cart lines, quantities, notes, totals, refresh/back navigation, and empty cart work.
- [ ] QA-QR-05 — Server ignores forged client price, rejects unavailable/deleted item and invalid quantity, and charges current price.
- [ ] QA-QR-06 — Submit creates/appends exactly once to correct table/order and creates the expected kitchen delta.
- [ ] QA-QR-07 — Double tap, retry, concurrent customers, stale menu, network interruption, and rate limit leave no duplicate/corrupt lines.
- [ ] QA-QR-08 — Customer sees accurate live status without staff/customer/other-table sensitive detail.

## 5. Authentication, session, navigation, and RBAC

### QA-AUTH

- [ ] QA-AUTH-01 — Correct credentials for every active role succeed and route correctly; wrong username/PIN and inactive user fail generically.
- [ ] QA-AUTH-02 — Leading/trailing input, case rules, Unicode, empty, very long, malformed JSON, and injection strings fail safely.
- [ ] QA-AUTH-03 — Login rate limit returns 429 at configured threshold and recovers after window without locking legitimate users permanently.
- [ ] QA-AUTH-04 — Cookie flags are HttpOnly/Secure/SameSite=Strict as appropriate; CSRF cookie/header behavior is correct.
- [ ] QA-AUTH-05 — Logout invalidates server session; back button/reuse of cookie or bearer cannot reopen protected data.
- [ ] QA-AUTH-06 — Expired, random, truncated, and revoked tokens return 401; multiple supported sessions follow policy.
- [ ] QA-AUTH-07 — Missing/mismatched CSRF on every representative cookie-authenticated POST/PUT/PATCH/DELETE returns 403/no write.
- [ ] QA-AUTH-08 — Admin has all actions. Default waiter/cashier permissions match `BUSINESS_LOGIC.md`; kitchen scope is restricted.
- [ ] QA-AUTH-09 — Change waiter/cashier permission in settings; UI updates and direct API enforcement changes on the next request.
- [ ] QA-AUTH-10 — Direct URL, crafted API, ID substitution, and hidden-control attempts cannot bypass role/action checks.
- [ ] QA-AUTH-11 — Login picker exposes only intended active-user fields; no credential hash, salary, phone, token, or inactive account.

## 6. Tables, reservations, customers, and leads

### QA-TBL — `/admin/tables`, `/admin/table-management`

- [ ] QA-TBL-01 — Create/edit/deactivate/delete floor and type with unique/required validation and correct dependency handling.
- [ ] QA-TBL-02 — Create/edit table name/number, capacity, floor, type, status; boundary/duplicate values fail safely.
- [ ] QA-TBL-03 — Live floor board status/counts match active orders/reservations after refresh and concurrent terminal changes.
- [ ] QA-TBL-04 — Opening an order occupies table; final payment releases it according to reservation/cleaning state.
- [ ] QA-TBL-05 — Transfer preserves order, items, totals, KOT, customer/waiter, source/destination state, and audit record.
- [ ] QA-TBL-06 — Merge preserves all lines/totals and rejects same table, incompatible/terminal/conflicting/stale operations.
- [ ] QA-TBL-07 — Repeat/concurrent transfer/merge does not duplicate order/items or leave two occupied claims.
- [ ] QA-TBL-08 — Generate/print QR resolves correctly; rotate token invalidates prior QR and new token remains unique.

### QA-RES — `/admin/leads`, `/waiter/reservations`

- [ ] QA-RES-01 — Public/admin reservation create and list/search/date/status filters agree.
- [ ] QA-RES-02 — Confirm/check-in/seat/change-table/complete/cancel/no-show paths set coherent status/timestamps/reason.
- [ ] QA-RES-03 — Hold, grace, dining, cleaning, auto-cancel, alert, and minimum-lead settings behave at before/exactly/after boundaries.
- [ ] QA-RES-04 — Capacity, overlap, occupied table, concurrent seat, and stale change-table conflicts are blocked with no partial update.
- [ ] QA-RES-05 — Seating links customer/table/order once; paying linked order completes reservation and correct table lifecycle.
- [ ] QA-RES-06 — VIP, deposit flags/amount, preferences, occasion, notes, source, and Unicode survive edits.
- [ ] QA-RES-07 — Inquiry list/count, read/update notes/status, pagination/filter, and unauthorized access work correctly.

### QA-CUS — `/admin/customers`

- [ ] QA-CUS-01 — Create/edit/search/delete customer with name/phone/email normalization, duplicate phone behavior, and validation.
- [ ] QA-CUS-02 — Link customer to reservation/order/bill; visit/spend/history values reconcile to sources.
- [ ] QA-CUS-03 — Dependency-aware delete and data privacy prevent orphan or public exposure.

## 7. Menu, order entry, kitchen, and billing

### QA-PROD — `/admin/products`, `/admin/categories`

- [ ] QA-PROD-01 — Category CRUD, ordering, counts, duplicate/blank/long names, and delete-with-items behavior.
- [ ] QA-PROD-02 — Product create/edit/delete validates category, name, finite non-negative price, availability, veg flag, description, barcode/variant where shown.
- [ ] QA-PROD-03 — Availability, price, category, and deletion propagate consistently to staff/public ordering without changing historical billed lines.
- [ ] QA-PROD-04 — Image upload accepts supported real images, rejects oversize/wrong MIME/extension/polyglot/traversal, and handles replace/orphan policy.

### QA-ORD — waiter/admin/cashier new-order and order detail/history routes

- [ ] QA-ORD-01 — Create dine-in/walk-in order as supported with correct table/customer/waiter/channel/number/time.
- [ ] QA-ORD-02 — Add multiple items, variant, quantity boundaries, duplicate item behavior, line/order instructions, and current server price.
- [ ] QA-ORD-03 — Edit/remove/add-after-KOT rules preserve history and create only the intended KOT delta.
- [ ] QA-ORD-04 — Order totals and item status agree across waiter, admin, cashier, kitchen, API, and database.
- [ ] QA-ORD-05 — Search/filter/date/status/pagination/history/detail and refresh work with empty and large datasets.
- [ ] QA-ORD-06 — Unauthorized delete/status/discount/payment actions return 403 and no write.
- [ ] QA-ORD-07 — Concurrent edits, double click, stale screen, item unavailable mid-order, and network retry do not duplicate/corrupt.
- [ ] QA-ORD-08 — Cancel/delete/terminal behavior has required reason/authorization and intended table/stock/KOT/accounting impact.

### QA-KOT — `/kitchen`, `/admin/kitchen-analytics`

- [ ] QA-KOT-01 — New KOT appears once with order/table, items, quantities, notes, waiter/time, and correct urgency.
- [ ] QA-KOT-02 — Pending → preparing → ready/completed transitions work at item/ticket/order level and reject invalid reversals.
- [ ] QA-KOT-03 — Multiple KOTs/add-on items, simultaneous cooks, refresh/polling, stale update, and completed-ticket removal work.
- [ ] QA-KOT-04 — Timing fields and average prep/hour/chef analytics reconcile to controlled test tickets and date boundaries.
- [ ] QA-KOT-05 — Empty/loading/error/reconnect/audio/visual alert behavior is usable; polling creates no request storm.
- [ ] QA-KOT-06 — Kitchen role cannot access price-sensitive admin/accounting data or forbidden mutations.

### QA-BILL — cashier/admin billing, bill detail, console, payment history/reports

- [ ] QA-BILL-01 — Independent calculation matches subtotal, configured VAT, service charge, authorized discount, grand total, due, tendered, and change.
- [ ] QA-BILL-02 — Test 0, 1, fractional/rounding, large quantity/amount, maximum discount, zero bill with reason, and invalid negative/non-finite values.
- [ ] QA-BILL-03 — Cash, card, QR, eSewa, Khalti, credit, and other displayed methods store correct amount/reference and show correctly in history/reports.
- [ ] QA-BILL-04 — Split payment across two/three tenders rejects under/over/zero/negative invalid split and totals exactly to due.
- [ ] QA-BILL-05 — Double click, two cashiers, repeated request, browser retry, and mid-request interruption create at most one paid bill/accounting post.
- [ ] QA-BILL-06 — Payment atomically updates bill/order/table/reservation, payment rows, journal, and expected stock; forced failure rolls everything back.
- [ ] QA-BILL-07 — Receipt shows unique bill/order, business/VAT/PAN, date/time, cashier/table/customer, lines, taxes/service/discount, tenders/change, footer.
- [ ] QA-BILL-08 — Reprint does not repay or repost. 58mm/80mm preview and actual printer are legible, aligned, and page-efficient.
- [ ] QA-BILL-09 — Reopen requires allowed permission/reason, preserves audit trail, restores intended state, and supports a correct later repayment without duplicate effects.
- [ ] QA-BILL-10 — Void/full/partial refund enforce bounds/reason/role and create correct correction, payment, stock policy, and balanced reversal journal.

## 8. Inventory, recipes, purchasing, suppliers, wastage

### QA-INV — inventory, detail, stock, imports, categories, conversions

- [ ] QA-INV-01 — Inventory category CRUD and dependency behavior.
- [ ] QA-INV-02 — Item CRUD validates name/category/base unit, finite quantity/cost/minimum, menu link, supplier/notes, duplicates.
- [ ] QA-INV-03 — Restock and positive/negative adjustment produce exact on-hand, movement type/source/reference/user/time/reason.
- [ ] QA-INV-04 — Low/out-of-stock indicators behave at below/equal/above threshold; negative stock follows configured rule.
- [ ] QA-INV-05 — Unit conversion create/edit/delete rejects zero/negative factor and preserves physical quantity/cost across base/purchase/recipe units.
- [ ] QA-INV-06 — Moving-average cost matches hand calculation after multiple receipts at different costs.
- [ ] QA-INV-07 — History filters/pagination/balance sequence reconcile to on-hand; concurrent adjustments do not lose updates.
- [ ] QA-INV-08 — CSV import validates headers, preview/mapping, Unicode, duplicates, mixed-validity rollback policy, large file, and exact created/updated counts.

### QA-REC — `/admin/recipes`, `/admin/recipes/[id]`

- [ ] QA-REC-01 — Create/edit/delete recipe, yield, menu link, ingredient/sub-recipe lines, quantities/units, duplicate/cycle prevention.
- [ ] QA-REC-02 — Recipe cost is sum of normalized ingredients; margin updates after cost or menu-price change.
- [ ] QA-REC-03 — Controlled order deducts exact recipe quantity once; add/cancel/reopen/refund paths follow documented policy without double movement.
- [ ] QA-REC-04 — Insufficient/missing ingredient behavior is clear and consistent with the business rule.

### QA-PUR — purchases/import, suppliers, accounts payable

- [ ] QA-PUR-01 — Supplier CRUD/search/merge validates identity/contact and preserves purchase/payable history.
- [ ] QA-PUR-02 — Receive multi-line purchase; normalized quantity, line/total cost, date/reference/supplier/payment method are exact.
- [ ] QA-PUR-03 — Receipt increases inventory once, updates moving cost, creates traceable movements, and posts balanced cash/bank/AP journal.
- [ ] QA-PUR-04 — Credit purchase appears under correct supplier AP/ageing; partial/full payment reduces only that supplier balance and selected cash/bank.
- [ ] QA-PUR-05 — Edit/delete posted purchase correctly reverses/replaces stock and journal or is safely prohibited.
- [ ] QA-PUR-06 — Import covers valid, duplicate, unknown item/unit/supplier, malformed row, Unicode, rounding, large file, and atomicity policy.

### QA-WST — `/admin/wastage` and staff wastage modal

- [ ] QA-WST-01 — Allowed roles log inventory/prepared-food wastage with valid quantity/unit/reason/notes/employee/shift/photo.
- [ ] QA-WST-02 — Standard reason vocabulary and custom/required reason behavior are correct.
- [ ] QA-WST-03 — Stock decreases exactly once and Dr Wastage / Cr Inventory journal balances; no cash movement.
- [ ] QA-WST-04 — History/filter/analytics totals reconcile; invalid, excessive, repeated, and concurrent submission are safe.

## 9. Employees, settings, permissions, and expenses

### QA-EMP — `/admin/employees`, `/admin/employee-performance`

- [ ] QA-EMP-01 — Employee create/edit/deactivate/delete validates unique username, full name, role, salary, hire date, position, and credential rules.
- [ ] QA-EMP-02 — Reset/change PIN invalidates or preserves sessions according to policy; old credential fails and new succeeds.
- [ ] QA-EMP-03 — Admin cannot accidentally remove/deactivate the last usable admin where protected; dependency behavior is safe.
- [ ] QA-EMP-04 — Payroll partial/full/duplicate-period/payment/delete correction updates history and balanced cash/bank journal.
- [ ] QA-EMP-05 — Orders/sales/bills/wastage/performance metrics reconcile to controlled employee source records and date filters.

### QA-SET — `/admin/settings`

- [ ] QA-SET-01 — Business identity, contact, website, VAT/PAN/registration save/reload and appear only where intended.
- [ ] QA-SET-02 — VAT/service percentage accepts valid boundaries/decimal and rejects negative, excessive, blank/non-finite invalid values.
- [ ] QA-SET-03 — Reservation timer fields validate and immediately affect new calculations at boundaries.
- [ ] QA-SET-04 — Receipt footer and 58/80 size affect preview/print; hostile markup is escaped.
- [ ] QA-SET-05 — QR ordering toggle and payment QR/settings affect customer/cashier views correctly.
- [ ] QA-SET-06 — Permission changes follow server behavior described in QA-AUTH; admin remains full.
- [ ] QA-SET-07 — Non-admin GET/PUT and direct crafted keys are rejected; unknown/sensitive setting keys cannot be overwritten.

### QA-EXP — `/admin/expenses`, `/admin/expense-categories`

- [ ] QA-EXP-01 — Category CRUD validates duplicate/name/dependency and mapping.
- [ ] QA-EXP-02 — Expense CRUD validates category, positive finite amount, business date, method/source, supplier, notes, and receipt upload.
- [ ] QA-EXP-03 — Cash/bank/credit expense posts correct balanced accounts and source reference once.
- [ ] QA-EXP-04 — Edit/delete creates correct reversal/replacement or is prohibited; reports/ledger remain reconciled.
- [ ] QA-EXP-05 — Purchase/wastage-linked records are clearly distinguished and cannot be double-counted or unsafely edited.

## 10. Accounting and reporting

Use finance-approved expected entries for each controlled scenario. Never accept visual plausibility without reconciliation.

### QA-ACC — chart, ledger, cash/bank, AP, reports, corrections

- [ ] QA-ACC-01 — Chart of accounts create/edit/deactivate/delete obeys unique code/type/system-account and referenced-account rules.
- [ ] QA-ACC-02 — Every sale/payment method posts the approved debit/credit, amount, business date, description, and unique source reference.
- [ ] QA-ACC-03 — Purchase, expense, wastage, payroll, supplier payment, settlement, deposit, withdrawal, transfer, and exchange each post approved balanced lines once.
- [ ] QA-ACC-04 — General ledger filters/account/date/pagination/opening/running balance reconcile to raw journal lines.
- [ ] QA-ACC-05 — Open drawer with float, cash movements, expected balance, counted close, variance, repeat close, and next session are correct.
- [ ] QA-ACC-06 — Cash book and bank book totals reconcile to selected accounts; transfer debits/credits the right endpoints once.
- [ ] QA-ACC-07 — Payment settlement moves the correct method clearing balance to bank/cash without changing sales revenue.
- [ ] QA-ACC-08 — AP supplier totals and ageing buckets reconcile to credit purchases/payments at exact cutoff boundaries.
- [ ] QA-ACC-09 — Bank reconciliation lists correct lines, match/unmatch is auditable, statement balance/difference is correct, and no transaction amount changes.
- [ ] QA-ACC-10 — Void/refund/reversal/reopen retains original record, requires reason/role, is bounded/idempotent, and creates approved compensating entry.
- [ ] QA-ACC-11 — Trial balance debit-credit totals match and net to zero for every tested cutoff.
- [ ] QA-ACC-12 — P&L revenue/COGS/expenses/net income reconcile to ledger; balance sheet assets = liabilities + equity with retained/current result policy.
- [ ] QA-ACC-13 — Finance dashboard widgets reconcile to reports/ledger and handle empty/large/negative periods.
- [ ] QA-ACC-14 — Date-from/to, same day, month/year boundary, leap day, midnight Kathmandu/UTC, future date, invalid range, and export if shown are consistent.
- [ ] QA-ACC-15 — SQL invariant query returns zero unbalanced journals and zero duplicate paid bills after the full suite.

### QA-RPT — operational `/admin/dashboard`, `/admin/reports`, `/cashier/reports`

- [ ] QA-RPT-01 — Sales/orders/items/payment/customer/staff summaries reconcile to controlled source bills and exclude voided/unpaid records correctly.
- [ ] QA-RPT-02 — Filters, comparison, chart/table, pagination, empty state, large range, and refresh work without per-day/per-record request storms.
- [ ] QA-RPT-03 — Currency rounding, labels, timezone/date cutoff, and any CSV/print output match screen/source totals.
- [ ] QA-RPT-04 — Cashier/report permission allows intended range/data only; waiter/kitchen/unauthorized direct API is rejected.

## 11. Complete route/page coverage sweep

In addition to detailed cases, open every route below with the correct role, verify title/navigation, initial data, primary create/read/update/delete action where applicable, loading/empty/error/permission states, refresh/deep-link, and mobile/desktop layout.

| Area | Routes to sweep |
|---|---|
| Public/auth | `/`, `/menu`, `/order/[token]`, `/login` |
| Waiter | `/waiter`, `/waiter/dashboard`, `/waiter/new-order`, `/waiter/order/[id]`, `/waiter/history`, `/waiter/reservations` |
| Kitchen | `/kitchen` |
| Cashier | `/cashier`, `/cashier/console`, `/cashier/new-order`, `/cashier/order/[id]`, `/cashier/billing`, `/cashier/bill/[id]`, `/cashier/payment-history`, `/cashier/reports` |
| Admin orders/menu | `/admin`, `/admin/dashboard`, `/admin/new-order`, `/admin/orders`, `/admin/orders/[id]`, `/admin/order/[id]`, `/admin/billing`, `/admin/bill/[id]`, `/admin/products`, `/admin/categories` |
| Admin tables/customers | `/admin/tables`, `/admin/table-management`, `/admin/leads`, `/admin/customers` |
| Admin stock/procurement | `/admin/inventory`, `/admin/inventory/[id]`, `/admin/inventory-categories`, `/admin/unit-conversion`, `/admin/stock`, `/admin/stock/import`, `/admin/recipes`, `/admin/recipes/[id]`, `/admin/purchases`, `/admin/purchases/import`, `/admin/suppliers`, `/admin/wastage` |
| Admin people/expenses | `/admin/employees`, `/admin/employee-performance`, `/admin/expenses`, `/admin/expense-categories`, `/admin/settings`, `/admin/kitchen-analytics`, `/admin/reports` |
| Admin accounting | `/admin/finance-dashboard`, `/admin/chart-of-accounts`, `/admin/general-ledger`, `/admin/cash-book`, `/admin/bank-book`, `/admin/cash-drawer`, `/admin/bank`, `/admin/bank-reconciliation`, `/admin/settlements`, `/admin/cash-exchange`, `/admin/corrections`, `/admin/accounts-payable`, `/admin/financial-reports` |

Also verify unknown route renders `not-found`, forced page/API failures render safe error UI, and slow navigation shows loading feedback.

## 12. API, validation, and data integrity

### QA-API

- [ ] QA-API-01 — Compare all 100 `app/api/**/route.js` files to `API_DOCUMENTATION.md`; record method/auth/status coverage and any drift.
- [ ] QA-API-02 — Every protected API sample: no auth 401, wrong role/permission 403, valid role success, expired token 401.
- [ ] QA-API-03 — Every unsafe cookie-auth API sample: missing/bad CSRF 403/no write; correct CSRF success.
- [ ] QA-API-04 — Invalid JSON/content type, missing/extra fields, strings for numbers, null, booleans, huge/negative/non-finite values, unknown enums/IDs return safe 4xx.
- [ ] QA-API-05 — Pagination/date/search bounds prevent unbounded/slow access and return stable ordering/no duplicate pages.
- [ ] QA-API-06 — Legacy endpoints and all methods return 410/no state change.
- [ ] QA-API-07 — Errors never expose `debugStack`, `debugMessage` internals, SQL, schema, disk path, env, secret, or token. This is a launch blocker.
- [ ] QA-API-08 — Database outage, timeout, constraint, and upload disk failure return safe error and roll back the transaction.

### QA-DATA

- [ ] QA-DATA-01 — Run duplicate-paid-bill, journal-balance, foreign-key/orphan, stock-ledger, migration, and expired-session checks from `DATABASE_SCHEMA.md`.
- [ ] QA-DATA-02 — All IDs/numbers expected unique remain unique under concurrency.
- [ ] QA-DATA-03 — Delete/update cascades or restrictions retain required financial/audit history and create no orphan.
- [ ] QA-DATA-04 — Reload/restart after each critical mutation yields the same state; no client-only success.
- [ ] QA-DATA-05 — Unicode Nepali/English, punctuation, long text boundaries, and timezone timestamps persist and render without corruption.

## 13. Security testing

- [ ] QA-SEC-01 — TLS/certificate/HTTPS redirect, HSTS, CSP, nosniff, frame policy, referrer policy, permissions policy, cookie flags, and no mixed content.
- [ ] QA-SEC-02 — Stored/reflected XSS probes across customer, reservation, inquiry, notes/instructions, menu, supplier, expense, settings, receipt, and reports render as text.
- [ ] QA-SEC-03 — SQL injection probes in login, IDs, search/filter, public forms, and mutations do not alter query semantics or disclose errors.
- [ ] QA-SEC-04 — Raw and encoded path traversal/null-byte/absolute-path/dotfile requests to upload/media cannot read outside allowed directory.
- [ ] QA-SEC-05 — Disguised executable/SVG/script/polyglot/oversize upload is rejected and cannot execute under the application origin.
- [ ] QA-SEC-06 — ID enumeration and mass-assignment cannot expose/modify another user/table/customer/order/bill or protected setting/account field.
- [ ] QA-SEC-07 — Login/public/order rate limits resist repeat and basic forwarded-IP spoof attempts in the deployed proxy configuration.
- [ ] QA-SEC-08 — Secret scan of repository/build and dependency audit have no unaccepted high/critical result.
- [ ] QA-SEC-09 — Browser storage, cache, history, logs, analytics, URLs, receipts, and error screens do not leak credentials/session/sensitive records.
- [ ] QA-SEC-10 — Concurrent payment/refund/reopen/purchase/table/stock actions cannot bypass uniqueness or authorization.

## 14. Accessibility, responsive UX, and compatibility

- [ ] QA-A11Y-01 — Complete public reservation, login, waiter order, cashier payment, and main admin form by keyboard only; logical focus and visible focus.
- [ ] QA-A11Y-02 — Inputs have programmatic labels/instructions; errors are associated/announced; dialogs trap and restore focus; Escape behavior is safe.
- [ ] QA-A11Y-03 — Heading/order/landmark/button/link semantics are meaningful; icon-only controls have accessible names.
- [ ] QA-A11Y-04 — Text/control/status contrast, non-color status cues, 200% zoom, text resize, and reduced motion are usable.
- [ ] QA-A11Y-05 — Screen-reader smoke on public menu/reservation, login, order cart, payment modal, and data table.
- [ ] QA-UX-01 — At 320/375/768/1024/1440px no clipped primary action, overlapping modal, inaccessible table, or accidental horizontal page scroll.
- [ ] QA-UX-02 — Touch targets, numeric keyboard/input, scanner/camera denial fallback, orientation change, and mobile back behavior.
- [ ] QA-UX-03 — Chrome/Edge desktop and Chrome Android/Safari iOS produce consistent core results; print tested on supported desktop browser.
- [ ] QA-UX-04 — Loading, empty, validation, success, 401/403/404/409/429/500, offline, timeout, retry, and unsaved-change states use clear language.

## 15. Performance, reliability, and recovery

- [ ] QA-PERF-01 — Measure public/menu p50/p95, staff read p50/p95, mutation p95, largest reports, and build asset sizes on production-like volume; meet PRD targets or record acceptance.
- [ ] QA-PERF-02 — Kitchen/waiter polling has bounded frequency, cancels on unmount/background as designed, and no N+1/per-order request storm.
- [ ] QA-PERF-03 — Large menu/order history/ledger/report/import remains responsive, paginated, and does not exhaust DB pool/memory.
- [ ] QA-REL-01 — Restart during idle and active use recovers cleanly; submitted transaction is either fully committed once or fully rolled back.
- [ ] QA-REL-02 — Database outage/recovery, connection exhaustion, slow query, upload disk full/read-only, and printer unavailable fail safely with actionable UX.
- [ ] QA-REL-03 — Two terminals concurrently operate different tables without interference; same-resource conflicts preserve invariants.
- [ ] QA-REL-04 — Daily DB and upload backup succeeds, is encrypted/access-controlled, retained off-host, and monitored.
- [ ] QA-REL-05 — Restore to empty staging recovers schema, rows, images, login, order/payment, stock, journal, reports; record time-to-restore and data-loss window.
- [ ] QA-REL-06 — Previous compatible application release can be redeployed and health/P0 tests pass; incompatible schema rollback procedure is rehearsed/documented.

## 16. Automated/static checks

Run in a clean checkout and attach complete output. DB scripts use an isolated QA database.

```bash
npm run lint
npm run build
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

- [ ] QA-AUTO-01 — Every command passes or each failure has accepted defect/risk evidence.
- [ ] QA-AUTO-02 — Clean build emits no unexpected deprecation, route, hydration, or security warning.
- [ ] QA-AUTO-03 — No focused/skipped test, unreviewed snapshot, or environment-dependent false pass hides coverage.

## 17. Final reconciliation and sign-off

- [ ] QA-END-01 — Count controlled test orders, paid/unpaid/void/refund bills, payments by method, purchases, expenses, payroll, wastage, stock movements, and journal entries; all reconcile.
- [ ] QA-END-02 — Duplicate paid bill and unbalanced journal queries return zero; no unexplained negative stock or stuck occupied table/reservation.
- [ ] QA-END-03 — Clear/archive test data using an approved method or deploy a clean restored production baseline; never manually delete linked rows ad hoc.
- [ ] QA-END-04 — All P0/P1 outcomes and defects are reviewed; no S1/S2 remains.
- [ ] QA-END-05 — QA, engineering, finance, operations, and owner complete `LAUNCH_CHECKLIST.md` with GO/NO-GO decision.

## 18. Production post-deploy smoke

Use designated non-customer test records and reverse them through supported workflows.

- [ ] Site/menu/login/health and security headers/cookies.
- [ ] One account per role and forbidden-access sample.
- [ ] One table order → KOT → ready → bill → payment → receipt → released table.
- [ ] One public reservation and one valid/invalid QR check.
- [ ] One image read from persistent uploads.
- [ ] Payment/report/ledger/journal reconciliation and log review.
- [ ] Backup job next-run visibility and monitoring alerts active.

## 19. Enhancement release checks (2026-08-05)

### QA-BRAND - browser and PWA branding

- [ ] QA-BRAND-01 - Clean browser loads favicon, 32px, Apple, 192px, and 512px icons without 404/MIME error; cache version is 2083.
- [ ] QA-BRAND-02 - Root/page titles, login, public site, manifest, installed PWA, social preview, receipts, and admin shell use only Kathmandu Momo branding.
- [ ] QA-BRAND-03 - Favicon remains recognizable at 16px/32px and is not a squeezed wordmark.

### QA-ANX - analytics and inventory dashboards

- [ ] QA-ANX-01 - Analytics presets and Custom use consistent Nepal-local inclusive/exclusive boundaries; This Week starts Monday.
- [ ] QA-ANX-02 - Sales, discounts, refunds, payments, purchases, expenses, COGS, profit, count, and AOV reconcile to controlled invoices and ledger.
- [ ] QA-ANX-03 - Pending/cancelled/void add no revenue; refunds and split payments are counted exactly once; unsupported metrics say Unavailable.
- [ ] QA-ANX-04 - Inventory value, SKU status counts, movements, wastage, and recipe consumption reconcile; mixed physical units are never summed.

### QA-CMS - website CMS and persistent media

- [ ] QA-CMS-01 - Admin can read/save approved Brand, Home, About, Gallery, Contact, Reservation, and SEO fields; every other role/direct unauthenticated request is denied.
- [ ] QA-CMS-02 - Public landing reflects published content within cache policy and retains usable fallback during CMS failure; POS menu remains the sole menu/price source.
- [ ] QA-CMS-03 - Valid image types succeed; empty, executable, oversized, excessive-dimension, extension mismatch, disguised, and polyglot files fail safely.
- [ ] QA-CMS-04 - Upload path traversal/collision/concurrency is safe; responses expose no stack/path; metadata and upload audit are correct.
- [ ] QA-CMS-05 - Referenced media cannot archive; unreferenced archive is audited; uploaded media survives restart and rehearsed cPanel deploy via persistent `UPLOADS_DIR`.
- [ ] QA-CMS-06 - Gallery title/url/alt/order/visibility behavior is correct; malformed JSON/unsafe URL cannot break or compromise the public page.
- [ ] QA-CMS-07 - CMS controls are labeled and keyboard accessible with clear loading/empty/error/success states at 360/768/1280/1536px.

### QA-BM - central bills and supplements

- [ ] QA-BM-01 - Bill tabs are explicit, mutually exclusive, accurately counted, and cover all supported states/channels.
- [ ] QA-BM-02 - Search/date/channel/reopened filters, pagination, and order execute server-side and remain stable during writes.
- [ ] QA-BM-03 - Desktop rows/mobile cards and details reconcile identifiers, channel, table, customer, staff, totals, paid/balance, states, KOT, payments, corrections, revisions, and times.
- [ ] QA-BM-04 - View/reopen/void/refund/payment/reprint permissions are enforced by API; significant actions require confirmation/reason and append audit.
- [ ] QA-BM-05 - Reopen creates a different empty supplemental order and never modifies original paid bill, completed order, items, payment, stock, KOT, or journal.
- [ ] QA-BM-06 - Higher supplement bills only new items and posts incremental payment/revenue/tax/COGS/stock once; original payment remains.
- [ ] QA-BM-07 - Empty/unchanged supplement creates no duplicate financial/stock/KOT record; lower outcome requires established refund/credit/void.
- [ ] QA-BM-08 - One active supplement survives double-click, retry, two sessions, and PostgreSQL concurrency; table/stock/item/closed-period restrictions roll back cleanly.
- [ ] QA-BM-09 - Only new preparation items create KOT lines; settlement uses existing services, is idempotent, links parent bill, and prints clear 58mm/80mm references.

### QA-ERR - unexpected API responses

- [ ] QA-ERR-01 - Production unexpected 500s across auth/CMS/upload/analytics/inventory/billing/payment/KOT return only safe message/status/correlation ID.
- [ ] QA-ERR-02 - Bodies contain no debug fields, stack, SQL/schema, credential, absolute path, environment value, or dependency frame; diagnostics remain server-side.

### QA-ENH-REL - release evidence

- [ ] QA-ENH-REL-01 - Install, generator, invariant checks, lint, dependency audit, and production build pass on the release commit with no unaccepted high/critical result.
- [ ] QA-ENH-REL-02 - Migrations 026/027 apply on isolated PostgreSQL, backup restore succeeds, and constraints/indexes/counts are recorded.
- [ ] QA-ENH-REL-03 - Analytics-ledger, inventory-movement, and original-supplement reconciliation examples are attached.
- [ ] QA-ENH-REL-04 - Full role/public/QR/reservation/KOT/payment/printing/refund/accounting regressions, responsive screenshots, accessibility evidence, defect list, and approvals are attached.
