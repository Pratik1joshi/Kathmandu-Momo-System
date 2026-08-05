import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { ensureCmsSchema } from '@/lib/cms.js';
import { saveCmsImage } from '@/lib/uploads.js';
import { writeAudit } from '@/lib/audit.js';

export const runtime = 'nodejs';

export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const db = Database.getInstance();
    await ensureCmsSchema(db);
    const media = await db.all(`SELECT * FROM cms_media WHERE is_archived = 0 ORDER BY created_at DESC LIMIT 250`);
    return NextResponse.json({ media });
  } catch (error) {
    return handleRouteError(error, 'Could not load the media library.');
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
    const altText = String(form.get('alt_text') || '').trim().slice(0, 300);
    const url = await saveCmsImage(file);
    const db = Database.getInstance();
    await ensureCmsSchema(db);
    const result = await db.run(
      `INSERT INTO cms_media (url, original_name, mime_type, size_bytes, alt_text, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [url, String(file.name || '').slice(0, 255), file.type || null, Number(file.size) || 0, altText, auth.user.id]
    );
    const media = await db.get(`SELECT * FROM cms_media WHERE id = ?`, [result.lastInsertRowid]);
    await writeAudit(db, { event_type: 'media.uploaded', entity_type: 'cms_media', entity_id: media.id, actor: auth.user, after: media });
    return NextResponse.json({ success: true, media }, { status: 201 });
  } catch (error) {
    if (error?.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    return handleRouteError(error, 'Could not upload the image.');
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request, { roles: ['admin'] });
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'Media id is required.' }, { status: 400 });
    const db = Database.getInstance();
    await ensureCmsSchema(db);
    const media = await db.get(`SELECT * FROM cms_media WHERE id = ? AND is_archived = 0`, [id]);
    if (!media) return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    const reference = await db.get(`SELECT content_key FROM cms_content WHERE content_value LIKE ? LIMIT 1`, [`%${media.url}%`]);
    if (reference) return NextResponse.json({ error: `This image is still used by ${reference.content_key}. Replace it before archiving.` }, { status: 409 });
    await db.run(`UPDATE cms_media SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    await writeAudit(db, { event_type: 'media.archived', entity_type: 'cms_media', entity_id: id, actor: auth.user, before: media });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Could not archive the image.');
  }
}

