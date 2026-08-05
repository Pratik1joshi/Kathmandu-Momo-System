import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'data', 'menu-2083.json');
const freshPath = path.join(root, 'deploy', 'menu-pack', 'seed_menu.sql');
const migrationPath = path.join(root, 'migrations', '026_menu_2083.sql');
const manifestPath = path.join(root, 'deploy', 'menu-pack', 'manifest.json');
const readmePath = path.join(root, 'deploy', 'menu-pack', 'README.txt');
const imageDir = path.join(root, 'deploy', 'menu-pack', 'menu');
const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const slug = (value) => String(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const imageAliases = {
  'egg-fried-rice-full': 'egg-fried-rice',
  'veg-fried-rice-full': 'veg-fried-rice',
  'chicken-fried-rice-full': 'chicken-fried-rice',
  'mixed-fried-rice-full': 'mixed-fried-rice',
  'veg-chow-mein-full': 'veg-chow-mein',
  'chicken-chow-mein-full': 'chicken-chow-mein',
  'papad-fry': 'fry-papad',
  'fruit-salad': 'fruits-salad',
  'chau-chau-sandeko-with-peanuts': 'chauchau-sadheko',
  'aloo-sandeko': 'aaloo-sadheko',
  'chicken-roast': 'chicken-roast',
  'hot-and-sour-soup-veg': 'hot-and-sour-soup',
  'mineral-water': 'mineral-water',
  'black-tea': 'black-tea',
  'hot-lemon-with-honey': 'hot-lemon-with-honey',
  'red-bull': 'red-bull',
};

function imageFor(name) {
  const key = slug(name);
  const candidate = imageAliases[key] || key;
  const filename = `${candidate}.jpg`;
  return fs.existsSync(path.join(imageDir, filename)) ? `/uploads/menu/${filename}` : null;
}

function validate() {
  const categoryNames = new Set(data.categories.map((c) => c.name));
  const seen = new Set();
  for (const [category, name, price] of data.items) {
    if (!categoryNames.has(category)) throw new Error(`Unknown category: ${category}`);
    if (!name || !Number.isFinite(price) || price < 0) throw new Error(`Invalid item: ${name}`);
    const key = `${category}\u0000${name}`.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate category/item: ${category} / ${name}`);
    seen.add(key);
  }
}

validate();

const header = [
  '-- Kathmandu Momo official food menu 2083',
  `-- Generated from data/menu-2083.json (${data.source}).`,
  '-- Run npm run build:menu-2083 after changing the reviewed source data.',
  '',
];

const categories = data.categories.map((c, index) =>
  `INSERT INTO menu_categories (name, description, display_order, is_active) VALUES (${sql(c.name)}, ${sql(c.description || '')}, ${index + 1}, 1);`
);

const items = data.items.map(([category, name, price, vegetarian], index) => {
  const image = imageFor(name);
  return `INSERT INTO menu_items (name, description, category_id, base_price, image_url, is_vegetarian, is_available, display_order) SELECT ${sql(name)}, NULL, id, ${Number(price).toFixed(2)}, ${image ? sql(image) : 'NULL'}, ${vegetarian ? 1 : 0}, 1, ${index + 1} FROM menu_categories WHERE name = ${sql(category)};`;
});

const fresh = [
  ...header,
  'BEGIN;',
  '',
  'DELETE FROM menu_item_variants;',
  'DELETE FROM menu_items;',
  'DELETE FROM menu_categories;',
  '',
  'ALTER SEQUENCE menu_categories_id_seq RESTART WITH 1;',
  'ALTER SEQUENCE menu_items_id_seq RESTART WITH 1;',
  'ALTER SEQUENCE menu_item_variants_id_seq RESTART WITH 1;',
  '',
  ...categories,
  '',
  ...items,
  '',
  'COMMIT;',
  '',
].join('\n');

const migrationCategories = data.categories.map((c, index) => [
  `INSERT INTO menu_categories (name, description, display_order, is_active)`,
  `VALUES (${sql(c.name)}, ${sql(c.description || '')}, ${index + 1}, 1)`,
  `ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order, is_active = 1, updated_at = CURRENT_TIMESTAMP;`,
].join('\n'));

const migrationItems = data.items.flatMap(([category, name, price, vegetarian], index) => {
  const image = imageFor(name);
  const categoryExpr = `(SELECT id FROM menu_categories WHERE name = ${sql(category)} LIMIT 1)`;
  const predicate = `lower(trim(name)) = lower(trim(${sql(name)})) AND category_id = ${categoryExpr}`;
  return [
    `UPDATE menu_items SET base_price = ${Number(price).toFixed(2)}, image_url = COALESCE(${image ? sql(image) : 'NULL'}, image_url), is_vegetarian = ${vegetarian ? 1 : 0}, is_available = 1, display_order = ${index + 1}, updated_at = CURRENT_TIMESTAMP WHERE ${predicate};`,
    `INSERT INTO menu_items (name, description, category_id, base_price, image_url, is_vegetarian, is_available, display_order) SELECT ${sql(name)}, NULL, ${categoryExpr}, ${Number(price).toFixed(2)}, ${image ? sql(image) : 'NULL'}, ${vegetarian ? 1 : 0}, 1, ${index + 1} WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE ${predicate});`,
  ];
});

const migration = [
  '-- 026: Apply the reviewed Kathmandu Momo Food Menu 2083.',
  '-- Existing menu rows are retained for historical order references but made unavailable.',
  '-- Official rows are updated or inserted by category/name, making this migration rerunnable safely.',
  '',
  'BEGIN;',
  '',
  'UPDATE menu_items SET is_available = 0, updated_at = CURRENT_TIMESTAMP;',
  'UPDATE menu_categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP;',
  '',
  ...migrationCategories,
  '',
  ...migrationItems,
  '',
  'COMMIT;',
  '',
].join('\n');

fs.writeFileSync(freshPath, fresh);
fs.writeFileSync(migrationPath, migration);
fs.writeFileSync(manifestPath, JSON.stringify({
  source: data.source,
  uploadsDir: '/home/thehairc/kathmandu-momo',
  imagesPath: '/uploads',
  itemCount: data.items.length,
  categories: data.categories.map((category) => ({
    name: category.name,
    count: data.items.filter((item) => item[0] === category.name).length,
  })),
}, null, 2) + '\n');
fs.writeFileSync(readmePath, `Kathmandu Momo - official Food Menu 2083 pack
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
`);
console.log(`wrote ${path.relative(root, freshPath)} (${data.categories.length} categories, ${data.items.length} items)`);
console.log(`wrote ${path.relative(root, migrationPath)}`);
console.log(`wrote ${path.relative(root, manifestPath)} and ${path.relative(root, readmePath)}`);
