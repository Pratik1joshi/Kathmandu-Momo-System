# Future Roadmap

This roadmap separates production hardening from optional growth. Priority should be revalidated after launch data and staff feedback.

## P0 — before or immediately at launch

- Remove or production-gate `debugMessage`/`debugStack` from API error responses and add regression tests.
- Add automated integration coverage for authentication/RBAC/CSRF, payment idempotency, journal balance, inventory movement, table operations, bill correction/reopen, and public QR pricing.
- Establish monitored nightly database/upload backups and a recorded restore drill.
- Add release identifiers, request correlation IDs, sanitized structured error tracking, and alerts for 5xx/database/financial invariant failures.
- Baseline production-like performance with realistic menu, order, ledger, and report volumes.

## P1 — operational maturity

- Generate and validate an OpenAPI contract from route schemas.
- Add browser E2E tests for the four staff roles and public journeys, including real thermal printer acceptance procedures.
- Add explicit audit-event UI/export for permission changes, credentials, discounts, payments, voids, refunds, stock adjustments, settings, and table operations.
- Add scheduled integrity checks for duplicate payments, unbalanced journals, orphan rows, negative/abnormal stock, and stale table/order states.
- Improve accessibility to documented WCAG 2.2 AA targets and automate key scans.
- Add retention/privacy policy tooling for customer, employee, sessions, logs, and backups.

## P2 — business growth

- Multi-branch architecture with strict tenant isolation, branch-local numbering/settings/inventory, and consolidated reporting.
- Payment gateway integrations with signed webhooks, idempotency, settlement matching, and no storage of sensitive card data.
- Delivery/takeaway workflow, delivery zone/fee, customer notification, and aggregator integrations.
- Reservation confirmation/reminder messages and customer consent/preferences.
- Offline-resilient order capture with a designed conflict/synchronization model.
- Forecasting, purchase suggestions, recipe variance, waste trends, and staff scheduling.

## P3 — platform evolution

- Native or installable staff applications with device management.
- Kitchen station routing, coursing, modifier groups, and production forecasting.
- Loyalty, gift cards, promotions, and CRM segmentation with privacy controls.
- Fiscal/tax authority integrations after Nepal-specific legal/accounting review.
- API/webhook ecosystem for approved external integrations.

## Roadmap entry criteria

Each item needs an owner, user problem, success metric, security/privacy review, data migration/rollback plan, test plan, documentation update, and operational support plan before implementation.

