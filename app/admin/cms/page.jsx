'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, Copy, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { apiJson, authedRequest } from '@/lib/authed-fetch';

const SECTIONS = [
  { title: 'Brand and contact', fields: [
    ['brand_name', 'Full brand name'], ['brand_short_name', 'Short name'], ['logo_url', 'Logo URL'],
    ['public_email', 'Public email'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp'],
    ['location', 'Location'], ['map_url', 'Map URL'], ['facebook_url', 'Facebook URL'], ['instagram_url', 'Instagram URL'],
  ] },
  { title: 'Home', fields: [
    ['home_heading', 'Hero heading'], ['home_description', 'Hero description', 'textarea'],
    ['home_image_url', 'Hero image URL'], ['home_primary_label', 'Primary action label'],
    ['home_primary_url', 'Primary action URL'], ['home_secondary_label', 'Secondary action label'], ['home_secondary_url', 'Secondary action URL'],
  ] },
  { title: 'About and reservations', fields: [
    ['about_heading', 'About heading'], ['about_description', 'About description', 'textarea'],
    ['about_image_url', 'About image URL'], ['reservation_instructions', 'Reservation instructions', 'textarea'],
    ['contact_heading', 'Contact heading'], ['contact_description', 'Contact description', 'textarea'],
    ['gallery_json', 'Gallery JSON (title, url, alt, order, visible)', 'textarea'],
  ] },
  { title: 'SEO', fields: [
    ['seo_title', 'Page title'], ['seo_description', 'Meta description', 'textarea'],
    ['seo_og_image', 'Open Graph image'], ['seo_canonical_url', 'Canonical URL'],
  ] },
];

export default function CmsPage() {
  const [tab, setTab] = useState('content');
  const [content, setContent] = useState({});
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  const preview = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'media') setTab('media');
    Promise.all([apiJson('/api/admin/cms'), apiJson('/api/admin/media')])
      .then(([cms, library]) => { setContent(cms.content || {}); setMedia(library.media || []); })
      .catch((err) => setError(err.error || 'Could not load website content.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function update(key, value) { setContent((current) => ({ ...current, [key]: value })); }

  async function save() {
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await apiJson('/api/admin/cms', { method: 'PUT', body: JSON.stringify({ content }) });
      setContent(result.content || content); setMessage('Published content saved. The public site refreshes within about 30 seconds.');
    } catch (err) { setError(err.error || 'Could not save website content.'); }
    finally { setSaving(false); }
  }

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setError(''); setMessage('');
    try {
      const form = new FormData(); form.append('file', file); form.append('alt_text', altText);
      const response = await authedRequest('/api/admin/media', { method: 'POST', body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw result;
      setMedia((current) => [result.media, ...current]); setFile(null); setAltText(''); setMessage('Image uploaded to persistent CMS storage.');
    } catch (err) { setError(err.error || 'Could not upload the image.'); }
    finally { setUploading(false); }
  }

  async function archive(id) {
    if (!window.confirm('Archive this image? Referenced images cannot be archived.')) return;
    try {
      await apiJson('/api/admin/media', { method: 'DELETE', body: JSON.stringify({ id }) });
      setMedia((current) => current.filter((item) => item.id !== id)); setMessage('Image archived.');
    } catch (err) { setError(err.error || 'Could not archive the image.'); }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading website CMS</div>;

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div><h1 className="text-2xl font-bold text-gray-950">Website CMS</h1><p className="mt-1 max-w-3xl text-sm text-gray-600">Publish approved website copy and persistent images. Menu names, prices, and availability continue to come from the POS menu.</p></div>
        <div className="flex gap-1 border-b border-gray-200">
          <button onClick={() => setTab('content')} className={`px-4 py-3 text-sm font-semibold ${tab === 'content' ? 'border-b-2 border-red-700 text-red-800' : 'text-gray-600'}`}>Content</button>
          <button onClick={() => setTab('media')} className={`px-4 py-3 text-sm font-semibold ${tab === 'media' ? 'border-b-2 border-red-700 text-red-800' : 'text-gray-600'}`}>Media library <span className="ml-1 text-xs tabular-nums">{media.length}</span></button>
        </div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="h-4 w-4" />{message}</div>}

        {tab === 'content' ? <>
          <div className="grid gap-5 lg:grid-cols-2">
            {SECTIONS.map((section) => <section key={section.title} className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="mb-4 font-bold text-gray-950">{section.title}</h2><div className="space-y-4">{section.fields.map(([key, label, kind]) => <label key={key} className="block"><span className="mb-1.5 block text-sm font-medium text-gray-800">{label}</span>{kind === 'textarea' ? <textarea value={content[key] || ''} onChange={(e) => update(key, e.target.value)} rows="4" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100" /> : <input value={content[key] || ''} onChange={(e) => update(key, e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100" />}</label>)}</div></section>)}
          </div>
          <div className="sticky bottom-3 flex justify-end"><button onClick={save} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-5 text-sm font-semibold text-white shadow-lg active:scale-[0.97] disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving' : 'Save and publish'}</button></div>
        </> : <>
          <form onSubmit={upload} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 md:grid-cols-[180px_1fr_auto] md:items-end">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-800">Image file</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-semibold" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-800">Alt text</span><input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image for screen readers" className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label>
            <button disabled={!file || uploading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white active:scale-[0.97] disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload</button>
            {preview && <img src={preview} alt="Local upload preview" className="h-28 w-40 rounded-lg border object-cover" />}
          </form>
          {media.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500"><ImageIcon className="mx-auto mb-3 h-8 w-8" />No CMS images uploaded yet.</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{media.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white"><img src={item.url} alt={item.alt_text || ''} className="aspect-[4/3] w-full bg-gray-100 object-cover" /><div className="space-y-2 p-3"><p className="truncate text-sm font-medium text-gray-900">{item.original_name || 'Uploaded image'}</p><p className="min-h-8 text-xs text-gray-500">{item.alt_text || 'No alt text provided'}</p><div className="grid grid-cols-2 gap-2"><button onClick={() => { update('home_image_url', item.url); setTab('content'); setMessage('Hero image selected. Save and publish to apply it.'); }} className="rounded-md border px-2 py-2 text-xs font-semibold hover:bg-gray-50 active:scale-[0.97]">Use as hero</button><button onClick={() => { update('about_image_url', item.url); setTab('content'); setMessage('About image selected. Save and publish to apply it.'); }} className="rounded-md border px-2 py-2 text-xs font-semibold hover:bg-gray-50 active:scale-[0.97]">Use for about</button><button onClick={() => { navigator.clipboard.writeText(item.url); setMessage('Image URL copied.'); }} className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold hover:bg-gray-50 active:scale-[0.97]"><Copy className="h-3.5 w-3.5" />Copy URL</button><button onClick={() => archive(item.id)} className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 active:scale-[0.97]"><Archive className="h-3.5 w-3.5" />Archive</button></div></div></article>)}</div>}
        </>}
      </div>
    </div>
  );
}
