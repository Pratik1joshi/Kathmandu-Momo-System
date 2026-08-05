# Business Logic Reference

This document defines behavior QA should verify. Where UI wording differs, server-side rules and persisted state are authoritative.

## 1. Money and bill totals

Let `subtotal = Σ(unit price × quantity)` for valid order lines. Current settings describe tax and service as exclusive additions:

```text
VAT = subtotal × vat_percentage / 100
service charge = subtotal × service_charge_percentage / 100
grand total = subtotal + VAT + service charge - discount
amount due = grand total - valid prior payments/refunds as applicable
```

Verify actual rounding at line, component, bill, receipt, report, and journal level using values that produce fractional paisa. Negative totals, negative payment, over-refund, NaN, infinity, and unauthorized discount must be rejected. A zero-value bill requires the supported reason/authorization path. Bill total logic is centralized in `lib/billing-totals.js`.

## 2. Order and kitchen state

- Normal order lifecycle is pending → preparing → ready → completed.
- KOT and item status must not contradict the parent order in a terminal state.
- Kitchen timing fields (`prep_started_at`, `ready_at`, `prepared_by`) must be set once at the relevant transition and produce non-negative durations.
- Adding items creates a traceable delta/KOT; it must not silently resend or recount old items.
- Delete/cancel/terminal transitions require a permitted role and must preserve audit/accounting/stock invariants.

## 3. Tables

- Table identity, floor, type, capacity, and QR token are unique/valid according to schema/service rules.
- Opening an active table order occupies the table.
- Transfer moves the intended open order without duplication or data loss.
- Merge combines only compatible active tables/orders and retains line totals and attribution.
- Successful final payment releases the table; reservation cleaning/occupancy rules may affect the visible state.
- QR token rotation invalidates the previous URL.

## 4. Reservations

Default settings are hold 30 min, grace 20 min, dining 90 min, cleaning 10 min, auto-cancel 20 min, and minimum lead 60 min; admin values override them.

- Public input requires valid name, phone, date/time, and party size constraints.
- Conflicting assignment is rejected; capacity and active table state are respected.
- Status transitions and timestamps (check-in, seat, complete/cancel) are coherent.
- A seated reservation may link a customer, table, and order; completing payment completes the linked reservation.
- VIP/deposit/preferences/notes remain intact through edits where supported.

## 5. Menu and pricing

- Category and item availability controls public and order-entry visibility.
- The client never determines the charge: server retrieves current item price and availability.
- Quantity must be a finite positive allowed number; deleted/unknown item IDs fail safely.
- Price changes affect new lines only unless the product explicitly recalculates an unfinalized line.
- Menu image path must resolve through supported static/media routes and use an accepted image format/size.

## 6. Inventory, recipes, and units

- Every stock change has a stock-movement source, quantity delta, timestamp, and relevant reference.
- Purchase/restock increases stock; recipe consumption and wastage decrease stock; adjustments can do either with reason.
- Conversion formula must preserve physical quantity (for example, packs × units per pack → base units) and reject zero/negative conversion factors.
- Moving-average cost is recalculated only from valid inbound cost/quantity and cannot become non-finite.
- Recipe yield and ingredient quantities must be positive; food cost is the sum of normalized ingredient cost.
- Cancellation, bill reopen, refund, and correction paths must be tested for the intended stock effect and idempotency.

## 7. Purchases and supplier payable

- Purchase total equals normalized line quantities × unit cost plus/minus supported adjustments.
- Cash/bank payment credits the selected liquid account; credit purchase credits Accounts Payable and tags the supplier.
- Supplier payment reduces that supplier's outstanding payable exactly once.
- Editing/deleting a posted purchase must reverse or replace its stock and journal effects, not orphan them.

## 8. Expenses, wastage, and payroll

- Expense category, amount, date, method, and notes/receipt follow validation rules.
- Expense journal debits the mapped expense and credits cash, bank, or payable.
- Wastage reduces inventory and posts Dr Wastage / Cr Inventory; it is non-cash unless a separate transaction exists.
- Payroll payment debits payroll expense and credits the selected cash/bank source.
- Deletion/correction must preserve an auditable reversal instead of corrupting reports.

## 9. Accounting invariants

- For every posted journal entry: total debits = total credits within currency tolerance.
- Journal entries use a unique external/source reference where idempotency is required.
- No balance is edited directly; account, drawer, bank, supplier, and report balances derive from journal lines.
- Voids/refunds/reopens/corrections create auditable compensating behavior and never erase the original economic event silently.
- Trial balance net is zero; balance-sheet equation holds; report totals reconcile to the ledger and source documents for the same cutoff/timezone.

## 10. Roles and configurable actions

Configurable actions include create/edit orders, send KOT, view/print bills, discounts, complete/split payment, reopen/void/refund bills, transfer/merge tables, and report access. Admin is always allowed. Kitchen is restricted to kitchen responsibilities. UI hiding is convenience only; the server must return 403 for forbidden direct API calls.

## 11. Dates and timezone

Business date filters must be verified in `Asia/Katmandu`, including midnight boundaries and UTC conversion. Start/end date filters are inclusive only as implemented and must agree across dashboard, report, payment history, and ledger. Store and display timestamps without changing the economic day unexpectedly.

## 12. Idempotency and concurrency

Repeat/double-click/concurrent requests must not create duplicate paid bills, duplicate journal entries, duplicate stock deduction, duplicate purchase receipt, or two active claims on the same table. Conflicts should return a clear 4xx response and leave state unchanged.

