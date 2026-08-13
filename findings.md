# Findings

## POS images
- Menu API returns `image_url`; Admin POS was not rendering it.
- Fixed with shared `MenuItemImage` component (same as walk-in/waiter).

## Bills active orders
- Bills list was `FROM bills` only — open POS orders had no bill row until pay.
- Extended `listBills` to include live orders without bills; Active tab default; 15s refresh.

## Orders + KTM time
- Orders page was not polling; used browser `toLocaleString()`.
- Now: 12s auto-refresh, `formatNepalDateTime` (Asia/Kathmandu), status filters for awaiting_payment etc.
- `formatNepalDateTime` now parses SQLite UTC timestamps correctly.

## Customer profile
- New `/admin/customers/[id]` + `/api/admin/customers/[id]/profile`.
- Shows orders, bills, credit ledger, payments.

## Accounting gaps filled (preserve existing)
- Accounts Receivable page + API (ageing, receive payment).
- Finance dashboard: week/month sales, AR, AP, inventory, settlements, cash in/out, large txns; Nepal dates.
- Cash Flow report tab on Financial Reports.
- Nav: Accounts Receivable link.
