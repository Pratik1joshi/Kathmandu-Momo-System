# Website and WhatsApp Ordering

## Production model

Public submission creates an `online_order_requests` record and immutable item-price snapshots. It does **not** create an operational order, KOT, invoice, payment, journal, or stock movement.

`Public menu -> /order-online -> PENDING request -> Admin/Cashier review -> ACCEPTED POS order + one KOT -> READY -> existing cashier payment -> COMPLETED`

Website and WhatsApp share the live `menu_items` data and server-side pricing. Source (`WEBSITE` or `WHATSAPP`), request status, and payment status remain separate.

## Routes

- Customer checkout: `/order-online`
- Privacy-safe status: `/track-order/<lookup-token>`
- Admin queue: `/admin/orders/online`
- Cashier queue: `/cashier/online-orders`
- Submit API: `POST /api/public/online-orders`
- Status API: `GET /api/public/online-orders/<lookup-token>`
- Staff queue: `GET /api/admin/online-orders`
- Staff detail/action: `GET|PATCH /api/admin/online-orders/<id>`

## Safety rules implemented

- Totals and availability are calculated from the database, never trusted from the browser.
- A required idempotency key returns the same reference on retry.
- WhatsApp opens only after the pending request is stored; opening `wa.me` changes no status.
- CMS WhatsApp is preferred; the restaurant phone setting is the single fallback.
- Acceptance locks the pending row on PostgreSQL, rechecks availability/prices, creates one operational order and one KOT, and records an audit event.
- Reject and cancel require a reason.
- Existing cashier payment finalizes the linked request as `COMPLETED`/`PAID` in the same transaction.
- Kitchen sees only the accepted operational KOT, never a pending request.

## Migration and verification

Run `migrations/028_online_ordering.sql` through the normal migration command.

```bash
npm run check:online-orders
npx eslint lib/online-orders.js app/api/public/online-orders app/api/admin/online-orders components/online-order app/order-online app/track-order
npm run build
```

## Deliberate limits and production configuration

- Delivery is not exposed because no approved delivery workflow exists.
- Tax, discount, and delivery fees remain zero until verified pricing settings are connected.
- No WhatsApp Business webhook is assumed; staff manually matches the stable reference.
- Payment claims never mark a request paid; cashier payment is authoritative.
- Existing inventory behavior commits recipe/stock deduction at staff acceptance. A fake soft-reservation ledger was not added; changing that fulfillment point requires a dedicated reconciled inventory migration.
- Refunds remain in the existing bill/correction workflow; this queue does not duplicate accounting.
