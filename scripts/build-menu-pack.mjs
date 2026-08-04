/**
 * Build upload pack for cPanel:
 *   deploy/menu-pack/menu/*.jpg
 *   deploy/menu-pack/seed_menu.sql
 *   deploy/menu-pack/README.txt
 *
 * Usage: node scripts/build-menu-pack.mjs
 *
 * On server: upload menu/ into UPLOADS_DIR (/home/thehairc/kathmandu-momo/menu)
 * then run seed_menu.sql in phpPgAdmin.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'deploy', 'menu-pack');
const menuDir = path.join(outRoot, 'menu');

/** Unsplash photo ids used as stock food images (category pools). */
const POOLS = {
  snacks: [
    '1546069901-ba9599a7e63c',
    '1512621776951-a57141f2eefd',
    '1601050690597-df0568f70950',
    '1573080496219-bb080dd4f877',
    '1565299624946-b28f40a0ae38',
    '1555939594-58d7cb561ad1',
  ],
  breakfast: [
    '1525351484163-7529414344d8',
    '1568901346375-23c9450c58cd',
    '1550547660-d9450f859349',
    '1533089860892-a7c6f0a88666',
    '1506084868230-bb9d95c24759',
  ],
  soups: [
    '1476718406336-bb5a9690ee2a',
    '1547592180-85f173990554',
    '1604908176997-125f25cc6f3d',
  ],
  rice: [
    '1603133872878-684f208fb84b',
    '1604908176997-125f25cc6f3d',
    '1569718212165-3a8278d5f624',
    '1582878826629-29b7ad1cdc43',
  ],
  chicken: [
    '1598103442097-8b74394b95c6',
    '1604503468506-a8da13d82791',
    '1626082927389-6cd097cdc6ec',
    '1562967914-608f82629710',
    '1432139555190-58524dae6a55',
  ],
  mutton: [
    '1544025162-d76694265947',
    '1432139555190-58524dae6a55',
    '1604908176997-125f25cc6f3d',
  ],
  choila: [
    '1555939594-58d7cb561ad1',
    '1529042410759-befb1204b468',
    '1544025162-d76694265947',
  ],
  desserts: [
    '1563805042-7684c019e1cb',
    '1497034825429-c343d7c6a68f',
    '1551024506-0bccd828d307',
  ],
  drinks: [
    '1544145945-f90425340c7e',
    '1551024709-8f23befc6f87',
    '1495474472287-4d71bcdd2085',
    '1511920170033-f8396924c348',
  ],
  cakes: [
    '1578985545062-69928b1d9587',
    '1565958011703-44f9829ba187',
    '1563805042-7684c019e1cb',
    '1497034825429-c343d7c6a68f',
  ],
};

/**
 * @typedef {{ name: string, description: string, price: number, veg: 0|1, pool: string }} Item
 * @typedef {{ name: string, description: string, order: number, pool: string, items: Item[] }} Category
 */

/** @type {Category[]} */
const CATEGORIES = [
  {
    name: 'Snacks',
    description: 'Light bites & starters',
    order: 1,
    pool: 'snacks',
    items: [
      { name: 'Veg Boil', description: 'Seasonal vegetables, lightly boiled and seasoned', price: 300, veg: 1 },
      { name: 'Popcorn', description: 'Crispy buttered corn kernels', price: 150, veg: 1 },
      { name: 'Aalo Jeera', description: 'Cumin-tempered potatoes, Nepali style', price: 180, veg: 1 },
      { name: 'Aaloo Sadheko', description: 'Spiced potato salad with mustard oil & herbs', price: 200, veg: 1 },
      { name: 'Bhatmas Sadheko', description: 'Soybeans tossed with spices & chilli', price: 190, veg: 1 },
      { name: 'Peanuts Sadheko', description: 'Roasted peanuts with onion, tomato & spices', price: 220, veg: 1 },
      { name: 'Chips Chilly', description: 'Crispy potato chips in hot chilli sauce', price: 300, veg: 1 },
      { name: 'Mushroom Chilly', description: 'Button mushrooms in Indo-Chinese chilli gravy', price: 350, veg: 1 },
      { name: 'Paneer Pakauda', description: 'Golden-fried cottage cheese fritters', price: 300, veg: 1 },
      { name: 'Veg Pakauda', description: 'Mixed vegetable fritters, crisp & light', price: 150, veg: 1 },
      { name: 'Lasun Poleko', description: 'Char-grilled garlic, aromatic & bold', price: 170, veg: 1 },
      { name: 'Kaju Fry', description: 'Premium cashews, lightly fried & salted', price: 490, veg: 1 },
      { name: 'Dry Papad', description: 'Crisp roasted papad', price: 120, veg: 1 },
      { name: 'Fry Papad', description: 'Deep-fried papad, extra crunch', price: 180, veg: 1 },
      { name: 'Green Salad', description: 'Fresh garden greens with house dressing', price: 250, veg: 1 },
      { name: 'Fruits Salad', description: 'Seasonal fruits, lightly chilled', price: 380, veg: 1 },
      { name: 'Gundruk Sadheko', description: 'Fermented leafy greens with spice & oil', price: 150, veg: 1 },
      { name: 'Veg Khaja Set', description: 'Assorted vegetarian snack platter', price: 250, veg: 1 },
      { name: 'Chauchau Sadheko', description: 'Instant noodles tossed Nepali street style', price: 150, veg: 1 },
      { name: 'Mustang Aalu', description: 'Spicy mountain-style potato specialty', price: 280, veg: 1 },
      { name: 'French Fries', description: 'Golden fries with seasoning', price: 200, veg: 1 },
      { name: 'Chatpate', description: 'Tangy puffed-rice street snack', price: 120, veg: 1 },
    ],
  },
  {
    name: 'Breakfast',
    description: 'Morning favourites',
    order: 2,
    pool: 'breakfast',
    items: [
      { name: 'Veg Sandwich', description: 'Fresh vegetables between toasted bread', price: 90, veg: 1 },
      { name: 'Chicken Sandwich', description: 'Tender chicken filling, lightly toasted', price: 120, veg: 0 },
      { name: 'Veg Burger', description: 'Crispy veg patty with fresh toppings', price: 150, veg: 1 },
      { name: 'Chicken Burger', description: 'Juicy chicken patty, house sauce', price: 180, veg: 0 },
      { name: 'Aalu Paratha', description: 'Served with pickle & curd', price: 150, veg: 1 },
      { name: 'Plain Paratha Set', description: '3 pcs with veg aalu matar', price: 130, veg: 1 },
      { name: 'Grand Breakfast Combo', description: 'Sausage, 2 boiled eggs, sandwich or 2 aalu paratha', price: 300, veg: 0 },
    ],
  },
  {
    name: 'Soups',
    description: 'Warm & comforting',
    order: 3,
    pool: 'soups',
    items: [
      { name: 'Veg Manchow Soup', description: 'Indo-Chinese vegetable soup with crunch', price: 120, veg: 1 },
      { name: 'Mushroom Soup', description: 'Creamy mushroom broth', price: 150, veg: 1 },
      { name: 'Hot and Sour Soup', description: 'Tangy and spicy classic', price: 160, veg: 1 },
      { name: 'Tomato Cream Soup', description: 'Silky tomato cream, herb finish', price: 160, veg: 1 },
      { name: 'Chicken Manchow Soup', description: 'Hearty chicken manchow with fried noodles', price: 160, veg: 0 },
      { name: 'Local Chicken Soup', description: 'Traditional clear local chicken broth', price: 220, veg: 0 },
      { name: 'Mutton Soup', description: 'Rich mutton broth, slow simmered', price: 200, veg: 0 },
    ],
  },
  {
    name: 'Rice & Noodles',
    description: 'Flavourful rice & chow mein',
    order: 4,
    pool: 'rice',
    items: [
      { name: 'Veg Fried Rice', description: 'Wok-tossed rice with fresh vegetables', price: 150, veg: 1 },
      { name: 'Egg Fried Rice', description: 'Classic fried rice with scrambled egg', price: 200, veg: 0 },
      { name: 'Chicken Fried Rice', description: 'Chicken pieces tossed with fragrant rice', price: 180, veg: 0 },
      { name: 'Mixed Fried Rice', description: 'Combination fried rice, full flavour', price: 220, veg: 0 },
      { name: 'Veg Chow Mein', description: 'Stir-fried noodles with garden vegetables', price: 160, veg: 1 },
      { name: 'Chicken Chow Mein', description: 'Wok-fried noodles with chicken', price: 200, veg: 0 },
    ],
  },
  {
    name: 'Chicken',
    description: 'Snacks & mains',
    order: 5,
    pool: 'chicken',
    items: [
      { name: 'Chicken Roast', description: 'Slow-roasted chicken, aromatic spices', price: 200, veg: 0 },
      { name: 'Chicken Boil', description: 'Gently boiled chicken, clean & tender', price: 250, veg: 0 },
      { name: 'Chicken Lollipop', description: 'Crispy lollipop-cut wings', price: 280, veg: 0 },
      { name: 'Chicken Chilly', description: 'Indo-Chinese chilli chicken', price: 260, veg: 0 },
      { name: 'Chicken Fry Sadheko', description: 'Fried chicken tossed with Nepali spices', price: 270, veg: 0 },
      { name: 'Chicken Wings', description: 'Crispy wings with house seasoning', price: 380, veg: 0 },
      { name: 'Chicken Timur (Szechuan)', description: 'Sichuan pepper chicken, numbing heat', price: 300, veg: 0 },
      { name: 'Chicken Sekuwa', description: 'Charcoal-grilled chicken skewers', price: 200, veg: 0 },
      { name: 'Chicken Sausage', description: 'Grilled chicken sausage', price: 200, veg: 0 },
    ],
  },
  {
    name: 'Mutton',
    description: 'Premium cuts, Nepali style',
    order: 6,
    pool: 'mutton',
    items: [
      { name: 'Mutton Bhutan', description: 'Spicy dry mutton with chilli', price: 250, veg: 0 },
      { name: 'Kan Jibro', description: 'Traditional offal specialty', price: 350, veg: 0 },
      { name: 'Mutton Sekuwa', description: 'Charcoal-grilled mutton skewers', price: 480, veg: 0 },
      { name: 'Mutton Pakku', description: 'Slow-cooked spicy mutton curry', price: 450, veg: 0 },
      { name: 'Mutton Tas', description: 'Tender mutton tas preparation', price: 400, veg: 0 },
      { name: 'Mutton Polera', description: 'Grilled mutton, house spices', price: 420, veg: 0 },
      { name: 'Mutton Fry Sadheko', description: 'Fried mutton tossed with spices', price: 380, veg: 0 },
    ],
  },
  {
    name: 'Traditional Choila',
    description: 'Authentic Nepali delicacy',
    order: 7,
    pool: 'choila',
    items: [
      { name: 'Local Chicken Choila', description: 'Spiced local chicken choila', price: 330, veg: 0 },
      { name: 'Local Chicken Choila Poleko', description: 'Char-grilled local chicken choila', price: 380, veg: 0 },
      { name: 'Duck (Has) Choila Fry', description: 'Fried duck choila', price: 350, veg: 0 },
      { name: 'Duck (Has) Choila Poleko', description: 'Char-grilled duck choila', price: 400, veg: 0 },
      { name: 'Mutton Choila Fry', description: 'Fried mutton choila', price: 400, veg: 0 },
      { name: 'Mutton (Poleko) Choila', description: 'Char-grilled mutton choila', price: 450, veg: 0 },
    ],
  },
  {
    name: 'Desserts & Ice Cream',
    description: 'Sweet endings',
    order: 8,
    pool: 'desserts',
    items: [
      { name: 'Vanilla Ice Cream', description: 'Classic vanilla scoop', price: 85, veg: 1 },
      { name: 'Chocolate Ice Cream', description: 'Rich chocolate scoop', price: 90, veg: 1 },
      { name: 'Strawberry Ice Cream', description: 'Fruity strawberry scoop', price: 90, veg: 1 },
      { name: 'Pineapple Ice Cream', description: 'Tropical pineapple scoop', price: 95, veg: 1 },
      { name: 'Butterscotch Ice Cream', description: 'Butterscotch swirl scoop', price: 95, veg: 1 },
    ],
  },
  {
    name: 'Drinks',
    description: 'Refreshing soft drinks & hot beverages',
    order: 9,
    pool: 'drinks',
    items: [
      { name: 'Mineral Water', description: 'Bottled drinking water', price: 35, veg: 1 },
      { name: 'Coke / Fanta / Sprite / Soda', description: 'Chilled soft drink (regular)', price: 85, veg: 1 },
      { name: 'Red Bull', description: 'Energy drink', price: 200, veg: 1 },
      { name: 'Fresh Lime Soda', description: 'Fresh lime with soda', price: 100, veg: 1 },
      { name: 'Real Juice', description: 'Real juice — small Rs 100 / jumbo Rs 425', price: 100, veg: 1 },
      { name: 'Jumbo Coke', description: 'Large bottle soft drink', price: 425, veg: 1 },
      { name: 'Black Tea', description: 'Hot black tea', price: 40, veg: 1 },
      { name: 'Milk Tea', description: 'Classic milk tea', price: 60, veg: 1 },
      { name: 'Black Coffee', description: 'Hot black coffee', price: 90, veg: 1 },
      { name: 'Milk Coffee', description: 'Coffee with milk', price: 100, veg: 1 },
      { name: 'Hot Lemon with Honey', description: 'Warm lemon honey drink', price: 185, veg: 1 },
    ],
  },
  {
    name: 'Cakes & Pastry',
    description: 'Freshly baked daily - 10:00 AM to 10:00 PM',
    order: 10,
    pool: 'cakes',
    items: [
      { name: 'Black Forest (1 lb)', description: 'Classic black forest cake, 1 lb', price: 650, veg: 1 },
      { name: 'White Forest (1 lb)', description: 'White forest cake, 1 lb', price: 650, veg: 1 },
      { name: 'Strawberry (1 lb)', description: 'Strawberry cake, 1 lb', price: 650, veg: 1 },
      { name: 'Chocolate Cake (1 lb)', description: 'Rich chocolate cake, 1 lb', price: 900, veg: 1 },
      { name: 'Red Velvet (1 lb)', description: 'Red velvet cake, 1 lb', price: 1100, veg: 1 },
      { name: 'Cheesecake (1 lb)', description: 'Creamy cheesecake, 1 lb', price: 1500, veg: 1 },
      { name: 'Black Forest Pastry', description: 'Single-serve black forest pastry', price: 70, veg: 1 },
      { name: 'White Forest Pastry', description: 'Single-serve white forest pastry', price: 80, veg: 1 },
      { name: 'Strawberry Pastry', description: 'Single-serve strawberry pastry', price: 110, veg: 1 },
      { name: 'Chocolate Pastry', description: 'Single-serve chocolate pastry', price: 140, veg: 1 },
      { name: 'Cheesecake Pastry', description: 'Single-serve cheesecake pastry', price: 220, veg: 1 },
    ],
  },
];

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function unsplashUrl(photoId) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=800&h=600&q=70`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const getter = url.startsWith('https') ? https : http;
    const req = getter.get(
      url,
      {
        headers: {
          'User-Agent': 'KathmanduMomoMenuPack/1.0',
          Accept: 'image/*',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }
    );
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function pickFallbackSource(photoCache, menuDir) {
  for (const name of photoCache.values()) {
    if (name.endsWith('.jpg')) {
      const p = path.join(menuDir, name);
      if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p;
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(menuDir, { recursive: true });

  // Download unique pool photos once
  const photoCache = new Map(); // photoId -> local filename
  const allPhotoIds = [...new Set(Object.values(POOLS).flat())];
  console.log(`Downloading ${allPhotoIds.length} stock photos...`);

  for (const id of allPhotoIds) {
    const filename = `stock-${id.slice(0, 12)}.jpg`;
    const dest = path.join(menuDir, filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      photoCache.set(id, filename);
      continue;
    }
    try {
      await download(unsplashUrl(id), dest);
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 500) {
        throw new Error('empty download');
      }
      photoCache.set(id, filename);
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\nFailed ${id}: ${e.message} — reusing another stock JPG`);
      const fbSrc = pickFallbackSource(photoCache, menuDir);
      if (!fbSrc) throw new Error(`No fallback image available after failure of ${id}`);
      fs.copyFileSync(fbSrc, dest);
      photoCache.set(id, filename);
    }
  }
  console.log('\nPool photos ready.');

  // Copy/alias per-item files from pool (stable names for SQL)
  const rows = [];
  let itemOrder = 0;
  for (const cat of CATEGORIES) {
    const pool = POOLS[cat.pool] || POOLS.snacks;
    cat.items.forEach((item, idx) => {
      itemOrder += 1;
      const photoId = pool[idx % pool.length];
      const sourceName = photoCache.get(photoId);
      const itemSlug = slugify(item.name);
      const ext = path.extname(sourceName) || '.jpg';
      const itemFile = `${itemSlug}${ext}`;
      const src = path.join(menuDir, sourceName);
      const dst = path.join(menuDir, itemFile);
      fs.copyFileSync(src, dst);
      rows.push({
        category: cat.name,
        catDesc: cat.description,
        catOrder: cat.order,
        ...item,
        slug: itemSlug,
        file: itemFile,
        displayOrder: itemOrder,
      });
    });
  }

  // Remove pool stock-* files; keep only per-item filenames for upload
  for (const f of fs.readdirSync(menuDir)) {
    if (f.startsWith('stock-')) fs.unlinkSync(path.join(menuDir, f));
  }

  // Build SQL
  const sql = [];
  sql.push(`-- Kathmandu Momo menu seed`);
  sql.push(`-- 1) Upload deploy/menu-pack/menu/* to /home/thehairc/kathmandu-momo/menu/`);
  sql.push(`-- 2) Run this SQL in phpPgAdmin (Postgres)`);
  sql.push(`-- Safe to re-run: clears existing menu categories/items first.`);
  sql.push(``);
  sql.push(`BEGIN;`);
  sql.push(``);
  sql.push(`DELETE FROM menu_item_variants;`);
  sql.push(`DELETE FROM menu_items;`);
  sql.push(`DELETE FROM menu_categories;`);
  sql.push(``);
  sql.push(`-- Reset sequences`);
  sql.push(`ALTER SEQUENCE menu_categories_id_seq RESTART WITH 1;`);
  sql.push(`ALTER SEQUENCE menu_items_id_seq RESTART WITH 1;`);
  sql.push(``);

  for (const cat of CATEGORIES) {
    sql.push(
      `INSERT INTO menu_categories (name, description, display_order, is_active) VALUES ('${sqlEscape(cat.name)}', '${sqlEscape(cat.description)}', ${cat.order}, 1);`
    );
  }
  sql.push(``);

  for (const r of rows) {
    const url = `/uploads/menu/${r.file}`;
    sql.push(
      `INSERT INTO menu_items (name, description, category_id, base_price, image_url, is_vegetarian, is_available, display_order)` +
        ` SELECT '${sqlEscape(r.name)}', '${sqlEscape(r.description)}', id, ${r.price}, '${sqlEscape(url)}', ${r.veg}, 1, ${r.displayOrder}` +
        ` FROM menu_categories WHERE name = '${sqlEscape(r.category)}';`
    );
  }

  sql.push(``);
  sql.push(`COMMIT;`);
  sql.push(``);
  sql.push(`-- Verify: SELECT c.name, COUNT(i.id) FROM menu_categories c LEFT JOIN menu_items i ON i.category_id = c.id GROUP BY c.name ORDER BY MIN(c.display_order);`);

  const sqlPath = path.join(outRoot, 'seed_menu.sql');
  fs.writeFileSync(sqlPath, sql.join('\n') + '\n', 'utf8');

  const readme = `Kathmandu Momo — menu upload pack
=================================

Env (cPanel):
  UPLOADS_DIR = /home/thehairc/kathmandu-momo
  IMAGES_PATH = /uploads

Steps
-----
1. On the server, create the folder if needed:
     mkdir -p /home/thehairc/kathmandu-momo/menu
     chmod 750 /home/thehairc/kathmandu-momo

2. Upload EVERY .jpg from this pack's menu/ folder into:
     /home/thehairc/kathmandu-momo/menu/

3. In phpPgAdmin, open your app database and run:
     seed_menu.sql

4. Restart the Node.js app in cPanel.

5. Check:
     https://yoursite/menu
     https://yoursite/uploads/menu/veg-boil.jpg

Notes
-----
- Stock Unsplash photos (placeholders). Replace any file in menu/ with a
  real photo using the SAME filename to keep SQL URLs working.
- seed SQL deletes existing menu_categories / menu_items first.
- Total items: ${rows.length}
`;

  fs.writeFileSync(path.join(outRoot, 'README.txt'), readme, 'utf8');

  // Manifest for sanity
  fs.writeFileSync(
    path.join(outRoot, 'manifest.json'),
    JSON.stringify(
      {
        uploadsDir: '/home/thehairc/kathmandu-momo',
        imagesPath: '/uploads',
        itemCount: rows.length,
        categories: CATEGORIES.map((c) => ({ name: c.name, count: c.items.length })),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\nDone.`);
  console.log(`  Images: ${menuDir} (${rows.length} item files)`);
  console.log(`  SQL:    ${sqlPath}`);
  console.log(`  README: ${path.join(outRoot, 'README.txt')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
