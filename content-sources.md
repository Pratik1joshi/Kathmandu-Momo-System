# Content Sources & Verification Log — Dim Sum Puri Fastfood Restaurant

Every externally-visible fact on the public site, its source, and confidence.
Source priority: (1) client-supplied inputs & owned assets, (2) live Google
Business/Maps, (3) official FB/TikTok, (4) directories as cross-check only.

_Last updated: 2026-08-02._

| Field | Value used | Source | Confidence | Notes |
|-------|-----------|--------|-----------|-------|
| Business name | Dim Sum Puri Fastfood Restaurant | Client prompt + logo + storefront signage | High | Consistent across logo, storefront banner, prompt |
| Address | Birendranagar-6, New Road, Surkhet 21700, Nepal | Client prompt + logo/storefront ("Birendranagar-06, Surkhet") | High | Postal 21700 from prompt (not on signage) — confirm |
| Coordinates | 28.5967285, 81.6177138732444 | Client-supplied Google Maps embed | High | From the embed `pb` string |
| Phone / WhatsApp | +977 980-8174841 | Client prompt + storefront banner ("9808174841") | High | Storefront also shows a landline `053-…` (partly obscured) — not used |
| Email | dimsumpurifastfood@gmail.com | Client prompt | High | Not independently verified |
| Menu items & prices | 103 items, 13 groups | Client `Menu.xlsx` | High | See `menu-import-report.md`; "Cold Beverages" group name assumed |
| Facebook | facebook.com/BhansaGreenCafe | Client prompt | **Low — VERIFY** | Handle "BhansaGreenCafe" does not match the restaurant name |
| TikTok | @dimsum2080 | Client prompt | Medium | Not opened/verified (no scraping) |
| Logo & storefront photos | /images/brand/* | Client-provided (uploaded to /public/images) | High | Owned assets |
| Food photos | /public/images/*.jpg | Client-uploaded image pack | Medium | Appear to be a generic stock pack; 32/103 matched to menu items by name. Replace with real photos when available |
| Map embed | Supplied embed URL | Client prompt | High | Lazy-loaded; "Open in Google Maps" external link provided |

## Deliberately omitted (not verified — no fabrication)

- **Opening hours** — not supplied and not verified. Omitted from the site and
  from structured data. Add once confirmed.
- **Ratings / review counts / testimonials** — not verified. No `aggregateRating`
  in structured data; the site links to "Read reviews on Google" instead of
  copying reviews (Google attribution/ToS compliant).
- **Awards / "best" / "authentic" claims** — none made.

## Not performed (and why)

- **No scraping of Facebook / TikTok / Instagram / Google.** Requested by the
  client, but declined: violates those platforms' terms and protections and the
  implementation brief's Phase 5 rules. Gallery uses client-owned local assets
  only; Google content is linked, not copied.

## To confirm with client before launch

1. Correct Facebook page URL (current handle looks unrelated).
2. Opening hours (to add hours + structured data).
3. Postal code 21700 and exact street line.
4. Spelling corrections flagged in `menu-import-report.md` (Nascoffe→Nescafé,
   Lamonade, Burgar, Draigon, Saussage, Thupka→Thukpa, etc.).
5. Real food photography to replace the generic image pack.
6. VAT/PAN registration status and rate (billing tax currently 0%, editable).
