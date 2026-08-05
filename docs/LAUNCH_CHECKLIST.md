# Production Launch Checklist

Use this for the final go/no-go decision. Detailed evidence comes from `QA_CHECKLIST.md`. Record environment, release commit/tag, database migration level, date/time, and approvers.

## Release record

| Field | Value |
|---|---|
| Release/build | |
| Commit/tag | |
| Staging URL | |
| Production URL | |
| QA database snapshot/data set | |
| Test start/end | |
| QA lead | |
| Engineering lead | |
| Operations/owner | |
| Rollback owner | |

## Product and data

- [ ] Business name, address, phone, website, VAT/PAN, currency, VAT/service percentages, receipt footer, and paper size are approved.
- [ ] Menu categories, names, descriptions, price, veg marker, availability, and images are approved.
- [ ] Floors, types, tables, capacities, and printed QR codes match the physical restaurant.
- [ ] Inventory opening quantities, units/conversions, cost, minimum stock, suppliers, and recipes are approved.
- [ ] Chart of accounts, cash drawer, banks, opening balances, expense categories, and payable setup are approved by finance.
- [ ] Reservation timers, QR-ordering toggle, payment methods/QRs, and role permission overrides are approved.
- [ ] Staff accounts have correct names, roles, active status, secure PINs/passwords, and no shared/default credentials.

## Technical readiness

- [ ] Approved Node 22 production build completes from the lockfile.
- [ ] Production uses PostgreSQL and all migrations are applied exactly once.
- [ ] Required environment variables are set; no example secret/default admin credential remains.
- [ ] HTTPS, certificate, proxy, secure cookies, CSRF, rate limits, and security headers pass.
- [ ] Persistent uploads are writable, served safely, backed up, and survive deployment/restart.
- [ ] Health check, graceful restart, logs, disk space, database pool, and host resource limits pass.
- [ ] Database and uploads backup completed; restore drill passed with recorded evidence.
- [ ] Rollback package/process is ready and the rollback decision maker is available.

## Functional acceptance

- [ ] All P0 and required P1 cases in `QA_CHECKLIST.md` pass on the release candidate.
- [ ] Public website, menu, inquiry, reservation, and valid/invalid table QR journeys pass on mobile.
- [ ] Admin, waiter, kitchen, and cashier role journeys pass on intended devices.
- [ ] Full order → KOT → ready → bill → split/payment → receipt journey passes.
- [ ] Table transfer, merge, reservation seating/change, payment release, and QR rotation pass.
- [ ] Purchase → stock → recipe/order deduction → wastage/adjustment traceability passes.
- [ ] Expense, payroll, AP/payment, cash drawer, bank, settlement, correction/refund/reopen, and reconciliation pass.
- [ ] Source documents reconcile to operational reports, journal, trial balance, P&L, and balance sheet.
- [ ] 58mm and 80mm receipt/KOT printing is legible on the actual hardware.
- [ ] Accessibility, responsive, browser, performance, concurrency, error, and recovery checks pass.

## Defects and security

- [ ] No open Severity 1 or Severity 2 defect.
- [ ] Every accepted lower-severity defect has owner, workaround, risk acceptance, and target date.
- [ ] No client response/log exposes a stack, SQL, disk path, secret, token, or sensitive record.
- [ ] Dependency/secret/security scan has no unaccepted high or critical finding.
- [ ] Cross-role, direct API, CSRF, XSS, injection, traversal, upload, ID enumeration, and rate-limit tests pass.

## People and operations

- [ ] Staff training completed for login, orders, KOT, billing, refund escalation, table/reservation states, and outage fallback.
- [ ] Cash opening/closing, printer paper, payment reference, refund/void approval, and end-of-day reconciliation procedures rehearsed.
- [ ] Support contact, escalation tree, incident log, customer communication, and manual order fallback are ready.
- [ ] Launch window avoids an uncontrolled peak; monitoring coverage is assigned for the first full service.

## Go/no-go

| Role | Name | Decision/signature | Time |
|---|---|---|---|
| QA | | | |
| Engineering | | | |
| Finance/accounting | | | |
| Restaurant operations | | | |
| Product/owner | | | |

Decision: **GO / NO-GO / CONDITIONAL GO**. A conditional go must list exact accepted risks, owner, rollback trigger, and expiry.

