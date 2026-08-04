import { NextResponse } from 'next/server';
import Database from '@/lib/db/index';
import { resolvePeriodRange } from '@/lib/report-dates.js';
import { requireAuth, handleRouteError } from '@/lib/api-guard.js';
import { buildReport, getFilterOptions, REPORT_TABS } from '@/lib/reports.js';

export async function GET(request) {
  try {
    const auth = await requireAuth(request, { roles: ['admin'] });
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const requested = (searchParams.get('tab') || 'overview').toLowerCase();
    const tab = REPORT_TABS.includes(requested) ? requested : 'overview';

    const range = resolvePeriodRange(
      searchParams.get('period') || 'week',
      searchParams.get('startDate'),
      searchParams.get('endDate')
    );

    const filters = {
      employeeId: Number(searchParams.get('employeeId')) || null,
      categoryId: Number(searchParams.get('categoryId')) || null,
      paymentMethod: searchParams.get('paymentMethod') || null,
      orderType: searchParams.get('orderType') || null,
      search: (searchParams.get('search') || '').trim() || null,
      // export=1 lifts the detail-table cap so a download is the complete set,
      // not the first 500 rows the screen happened to show.
      exportAll: searchParams.get('export') === '1',
      detailLimit: Number(searchParams.get('detail_limit')) || null,
    };

    const db = Database.getInstance();
    const [data, options] = await Promise.all([
      buildReport(db, tab, range, filters),
      searchParams.get('withOptions') === '1' ? getFilterOptions(db) : Promise.resolve(null),
    ]);

    return NextResponse.json({ tab, range, filters, ...data, ...(options ? { options } : {}) });
  } catch (error) {
    return handleRouteError(error, 'Failed to build the report.');
  }
}
