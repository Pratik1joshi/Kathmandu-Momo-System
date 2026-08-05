import { ensureSqliteTable } from '@/lib/db/ensure-sqlite-table.js';

export const CMS_KEYS = new Set([
  'brand_name', 'brand_short_name', 'logo_url', 'public_email', 'phone', 'whatsapp',
  'location', 'map_url', 'facebook_url', 'instagram_url',
  'home_heading', 'home_description', 'home_image_url', 'home_primary_label',
  'home_primary_url', 'home_secondary_label', 'home_secondary_url',
  'about_heading', 'about_description', 'about_image_url',
  'gallery_json', 'reservation_instructions', 'contact_heading', 'contact_description',
  'seo_title', 'seo_description', 'seo_og_image', 'seo_canonical_url',
]);

export async function ensureCmsSchema(db) {
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS cms_content (
    content_key TEXT PRIMARY KEY,
    content_value TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await ensureSqliteTable(db, `CREATE TABLE IF NOT EXISTS cms_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    original_name TEXT,
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

export async function readCmsContent(db, { publishedOnly = false } = {}) {
  await ensureCmsSchema(db);
  const rows = await db.all(
    `SELECT content_key, content_value, is_published FROM cms_content${publishedOnly ? ' WHERE is_published = 1' : ''}`
  );
  return Object.fromEntries((rows || []).map((row) => [row.content_key, row.content_value]));
}

