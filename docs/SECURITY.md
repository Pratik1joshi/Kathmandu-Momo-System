# Security Guide

## 1. Security model

The application uses bcrypt-protected staff credentials, database-backed sessions, role and configurable action authorization, double-submit CSRF for cookie-authenticated mutations, DB-backed IP rate limiting, validation, and HTTP security headers. Security is enforced at the API, not only by hidden UI controls.

## 2. Authentication and session controls

- `pos_session` must be `HttpOnly`, `Secure` in production, `SameSite=Strict`, scoped to `/`, and have the intended expiration.
- `pos_csrf` is readable by the client but must also be provided in `x-csrf-token` for unsafe cookie-authenticated requests.
- Session tokens must be high entropy, stored/validated server-side, expire, and be invalidated on logout.
- Failed login is generic, timing-safe as practical, and rate-limited; inactive users cannot authenticate.
- First/default admin credential must be changed before launch. No production secret may equal `.env.example`.

## 3. Authorization matrix

| Action | Public | Waiter | Kitchen | Cashier | Admin |
|---|---:|---:|---:|---:|---:|
| View public menu / submit public form | Yes | Yes | Yes | Yes | Yes |
| Create/edit order, send KOT | QR-limited | Default yes | No | Default yes | Yes |
| Update kitchen ticket | No | As allowed by route | Yes | As allowed | Yes |
| Complete/split payment | No | Default no | No | Default yes | Yes |
| Discount/reopen | No | Default no | No | Default yes | Yes |
| Void/refund | No | Default no | No | Default no | Yes |
| Manage staff/settings/accounting | No | No | No | No | Yes |

The actual waiter/cashier action map can be overridden in Settings. QA must test both default and changed permissions with direct API calls.

## 4. Input and API security

- Use parameterized SQL through the database layer; test quote, comment, boolean, and time-delay injection payloads.
- Validate type, range, enum, length, ID ownership, state transition, and server-side price.
- Reject JSON prototype keys where dangerous, oversized payloads, malformed encodings, and non-finite numbers.
- Escape untrusted text in pages, receipts, exports, and logs; test stored/reflected XSS in names, notes, instructions, inquiries, suppliers, products, and settings.
- Public reservation, inquiry, login, and QR order abuse is rate-limited without trusting a spoofable forwarding header configuration.
- Legacy endpoints return 410 and perform no reads/writes.

## 5. File security

- Allow only necessary image formats and verified content; enforce byte-size and dimension limits.
- Generate filenames; do not trust client paths or original extensions.
- `/api/media` must block raw/encoded traversal, alternate separators, null bytes, absolute paths, dotfiles, `.env`, source files, and files outside `UPLOADS_DIR`.
- Uploads are non-executable and stored outside the public application source where possible.

## 6. Browser and transport controls

Expected middleware headers include CSP, `X-Content-Type-Options: nosniff`, frame protection, `Referrer-Policy`, `Permissions-Policy`, and production HSTS. Validate HTTPS redirect at the proxy, current TLS, no mixed content, correct certificate chain, and that CSP does not break required images/fonts/maps/analytics.

Review the CSP before launch: it currently permits inline/eval script allowances for application/tooling compatibility and permits configured Vercel sources. Reduce these allowances when feasible and ensure production domains are intentional.

## 7. Secrets, data, and logging

- `.env`, database credentials, session/CSRF secrets, admin seed credentials, payment references, and backups are never web-accessible or committed.
- DB user is restricted to the application database and only required permissions.
- Logs contain event/context but no credential, cookie, bearer token, full card/payment secret, raw sensitive payload, or absolute internal path.
- Customer/employee data access is role-limited. Export and backup access is audited and retained only per business policy.

## 8. Security test checklist

- [ ] Unauthenticated protected endpoints return 401.
- [ ] Cross-role and revoked-permission calls return 403 with no state change.
- [ ] Missing/mismatched CSRF on cookie mutation returns 403; valid CSRF succeeds.
- [ ] Reused/expired/logged-out session fails.
- [ ] Login and public rate limits return 429 and recover after the window.
- [ ] ID enumeration does not expose other records or forbidden financial/customer data.
- [ ] SQLi/XSS/traversal/upload polyglot tests fail safely.
- [ ] Duplicate/concurrent payment, refund, purchase, and table operations are idempotent/conflict-safe.
- [ ] Production errors contain no `debugStack`, SQL, disk path, or secret.
- [ ] Dependency and secret scans have no unaccepted high/critical finding.
- [ ] HTTPS/cookie/header/CORS behavior is correct on the real domain.

## 9. Important implementation review item

`lib/api-guard.js` currently constructs unexpected-error responses with `debugMessage` and `debugStack`. Although the normal message is sanitized, production QA must verify these fields are not returned to clients. Treat any internal stack, SQL detail, or filesystem path in a production response as a release blocker and remove/gate the debug fields before launch.

## 10. Incident basics

On suspected compromise: preserve logs, disable affected accounts/sessions, rotate session/CSRF/database/admin secrets, isolate the service if needed, back up evidence, assess affected records, restore from a known-good point, and document timeline/actions. Do not destroy evidence or overwrite the only backup.

