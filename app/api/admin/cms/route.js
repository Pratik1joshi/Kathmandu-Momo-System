import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { CMS_KEYS, ensureCmsSchema, readCmsContent } from '@/lib/cms.js';
import { writeAudit } from '@/lib/audit.js';

export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const db = Database.getInstance();
    const content = await readCmsContent(db);
    return NextResponse.json({ content });
  } catch (error) {
    return handleRouteError(error, 'Could not load website content.');
  }
}

export async function PUT(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const updates = body?.content && typeof body.content === 'object' ? body.content : body;
    const invalid = Object.keys(updates || {}).filter((key) => !CMS_KEYS.has(key));
    if (invalid.length) {
      return NextResponse.json({ error: `Unsupported content field: ${invalid[0]}` }, { status: 400 });
    }
    const db = Database.getInstance();
    await ensureCmsSchema(db);
    const before = await readCmsContent(db);
    await db.transaction(async (tx) => {
      for (const [key, raw] of Object.entries(updates || {})) {
        if (raw !== null && typeof raw === 'object') {
          return Promise.reject(Object.assign(new Error(`${key} must be text.`), { status: 400 }));
        }
        const value = raw == null ? '' : String(raw).slice(0, key === 'gallery_json' ? 20000 : 2000);
        await tx.run(
          `INSERT INTO cms_content (content_key, content_value, is_published, updated_by, updated_at)
           VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value,
             is_published = 1, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
          [key, value, auth.user.id]
        );
      }
      await writeAudit(tx, { event_type: 'cms.updated', entity_type: 'cms', entity_id: 'public-site', actor: auth.user, before, after: updates });
    });
    return NextResponse.json({ success: true, content: await readCmsContent(db) });
  } catch (error) {
    return handleRouteError(error, 'Could not save website content.');
  }
}

