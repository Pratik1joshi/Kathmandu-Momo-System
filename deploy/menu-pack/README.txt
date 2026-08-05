Kathmandu Momo - official Food Menu 2083 pack
================================================

Source of truth: data/menu-2083.json

Fresh database:
  1. Upload deploy/menu-pack/menu/* to UPLOADS_DIR/menu when matching images exist.
  2. Run deploy/menu-pack/seed_menu.sql after production_schema.sql and production_seed.sql.

Existing database:
  1. Deploy the application release.
  2. Run npm run db:migrate to apply migrations/026_menu_2083.sql.

The upgrade migration retains old rows for historical order references and makes
them unavailable. Official 2083 rows are updated/inserted and enabled. Items
without an approved image use the application's image fallback; no stock image
is downloaded automatically.

Run npm run build:menu-2083 after reviewing any source-data change.
