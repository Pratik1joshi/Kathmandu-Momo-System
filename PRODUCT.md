# Product
<!-- impeccable:product-schema 1 -->

## Platform

Responsive web application built with Next.js for desktop, tablet, and mobile use.

## Users

- Restaurant owner and administrators managing the whole operation.
- Cashiers taking payment and correcting billing mistakes.
- Waiters and kitchen staff moving orders through service.
- Public customers browsing the menu, reserving tables, and placing orders.

## Purpose

Run Kathmandu Momo from one source of truth for menu, orders, tables, kitchen, billing, inventory, accounting, customers, staff, and the public website.

## Positioning

An operations-first restaurant system. Fast service workflows and traceable financial records take priority over decorative presentation.

## Operating Context

Used at a Kathmandu Momo restaurant in Nepal, often in bright and busy conditions. Admin surfaces must work at high information density, public surfaces must be simple on mobile, and bills must remain suitable for thermal printing.

## Capabilities

- POS ordering for dine-in, takeaway, and delivery.
- Table, reservation, waiter, kitchen, KOT, and billing workflows.
- Menu and recipe management backed by the official 2083 menu document.
- Inventory, suppliers, purchasing, wastage, stock movements, and costing.
- Customer, employee, analytics, reports, and double-entry accounting.
- Website content and media management with public publishing.
- Audited corrections, refunds, voids, and linked supplemental bills.

## Brand Commitments

- Product and public brand name: Kathmandu Momo.
- Approved logo: `public/images/kathmandu-momo/logo.png`.
- Primary accent: Kathmandu Momo red, with neutral high-contrast admin surfaces.
- Preserve the existing Tailwind, Radix, and Lucide component language.
- Do not introduce inherited restaurant names, logos, colors, or sample-brand copy.

## Evidence

- `KTM MOMO FOOD MENU 2083.docx` is the authoritative current menu and price source.
- `Kathmandu_Momo_POS_Enhancement_Prompt.md` defines the current production enhancements.
- The repository implementation is authoritative for existing workflows and data invariants.

## Product Principles

1. Keep one source of truth for each business fact.
2. Put irreversible business rules on the server and inside transactions.
3. Preserve paid invoices, payments, stock movements, and journals as immutable history.
4. Require a reason and actor for sensitive corrections.
5. Show clear loading, empty, success, and error states.
6. Prefer fast, calm, high-contrast interfaces over decorative motion.

## Accessibility

Target WCAG 2.1 AA contrast and keyboard operation. Controls need visible labels and focus states, touch targets must remain usable on tablets, and functional meaning must not rely on color alone.
