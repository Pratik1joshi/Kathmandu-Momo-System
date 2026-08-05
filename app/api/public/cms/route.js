import { NextResponse } from 'next/server';
import Database from '@/lib/db/index.js';
import { readCmsContent } from '@/lib/cms.js';

export async function GET() {
  try {
    const content = await readCmsContent(Database.getInstance(), { publishedOnly: true });
    return NextResponse.json({ content }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ content: {} });
  }
}

