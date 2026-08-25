'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { AlertTriangle, Calendar, Download, RotateCcw, Search, X } from 'lucide-react';
import {
  QuickChips, KpiCards, ChartCard, ChartGrid, BarChart, TrendChart, RankBars,
  ScatterChart, BusinessInsights, DataTable, formatValue,
} from '@/components/admin/report-kit';
import DonutChart from '@/components/admin/donut-chart';
import { orderTypeLabel } from '@/lib/order-types.js';
import DateInput from '@/components/ui/date-input.jsx';
import { formatNepalDateTime } from '@/lib/report-dates.js';
import { CashFlowCard, ChannelMix, CountedCash, DigitalReceipts, MoneyPosition } from '@/components/admin/summary-kit.jsx';
import { AllChanges } from '@/components/analytics/order-operations-analytics';

const DONUT_COLORS = ['#0f172a', '#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#ea580c'];

function DonutBlock({ rows, centerLabel = 'Total', format = 'currency' }) {
  const segments = (rows || [])
    .filter((r) => Number(r.value) > 0)
    .map((r, i) => ({ label: r.label, value: Number(r.value), color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!segments.length) return null;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
      <DonutChart
        segments={segments}
        centerLabel={centerLabel}
        centerValue={formatValue(total, format)}
        size={170}
      />
      <div className="space-y-1.5 text-sm">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
            <span className="text-gray-600">{seg.label}</span>
            <span className="font-semibold tabular-nums text-gray-900">{formatValue(seg.value, format)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Reports analytics centre.
 *
 * Every tab follows the same shape: quick insight chips → KPI cards →
 * charts (one per card) → Business Insights → detailed table(s).
 * All data comes from /api/admin/reports, which computes it from the
 * live schema; nothing on this page is hard-coded.
 *
 * There is no Branch filter because this deployment is single-location —
 * no branch/outlet entity exists anywhere in the schema. There is no
 * Customer filter because orders.customer_id is never populated, and no
 * Supplier filter because suppliers are free-text on expenses only (the
 * Suppliers tab groups by that text instead).
 */

/*
 * Each report carries the question it answers, in the owner's words, and the
 * kind of report it is. `kind` drives the grouping in the tab bar and the
 * accent colour, so an admin can tell at a glance whether they are looking at
 * money, floor operations or an analytical cut — without having opened it.
 */
const KINDS = {
  financial: { label: 'Financial', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  operational: { label: 'Operational', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  analytical: { label: 'Analytical', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

const TABS = [
  { id: 'overview', label: 'Overview', kind: 'financial', blurb: 'How did the business trade this period — money in, profit, and anything that needs attention?' },
  { id: 'sales', label: 'Sales', kind: 'financial', blurb: 'What did we sell, what was it worth, and how was it paid for?' },
  { id: 'finance', label: 'Finance', kind: 'financial', blurb: 'What came in, what went out, and what was left over?' },
  { id: 'suppliers', label: 'Suppliers', kind: 'financial', blurb: 'Who did we buy from, and how much went to each of them?' },
  { id: 'orders', label: 'Orders', kind: 'operational', blurb: 'How did orders flow from the floor to the kitchen to the bill?' },
  { id: 'changes', label: 'Cancellations & Changes', kind: 'operational', blurb: 'What was cancelled, voided, refunded, re-billed or discounted — and by whom?' },
  { id: 'inventory', label: 'Inventory', kind: 'operational', blurb: 'What stock is on hand, what moved, and what needs reordering?' },
  { id: 'employees', label: 'Employees', kind: 'operational', blurb: 'Who served and settled what, and how fast did the kitchen turn tickets around?' },
  { id: 'tables', label: 'Tables', kind: 'operational', blurb: 'Which tables earn, which sit idle, and how long is a sitting?' },
  { id: 'reservations', label: 'Reservations', kind: 'operational', blurb: 'How is the booking book looking, and how many people never showed?' },
  { id: 'menu', label: 'Menu', kind: 'analytical', blurb: 'Which dishes earn their place on the menu, and which do not?' },
  { id: 'customers', label: 'Customers', kind: 'analytical', blurb: 'Who is coming back, and what are they worth?' },
];

/**
 * Groups for the tab bar. `allowed` comes from the server (a cashier gets a
 * subset); the server refuses anything outside it regardless, this just avoids
 * showing a tab that would 403.
 */
function tabGroupsFor(allowed) {
  const visible = allowed?.length ? TABS.filter((t) => allowed.includes(t.id)) : TABS;
  return ['financial', 'operational', 'analytical']
    .map((kind) => ({ kind, label: KINDS[kind].label, tabs: visible.filter((t) => t.kind === kind) }))
    .filter((group) => group.tabs.length);
}

/*
 * resolvePeriodRange already understood yesterday, last 30 days, last month and
 * year-to-date; the UI only ever offered three of its presets, so an owner
 * wanting last month had to work out and type the dates by hand.
 */
const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
];

const FILTER_LABELS = {
  businessDayId: 'Business day',
  employeeId: 'Employee',
  categoryId: 'Category',
  foodGroup: 'Master category',
  paymentMethod: 'Payment method',
  orderType: 'Order type',
  search: 'Search',
};

const allZero = (series) => !series?.length || series.every((d) => !d.value);

function selectClass(enabled = true) {
  const base = 'h-10 rounded-lg border px-3 text-sm';
  return enabled
    ? `${base} border-gray-300 bg-white text-gray-700`
    // Visibly inert, with the reason on hover — an owner should never change a
    // control and watch nothing happen.
    : `${base} cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState('overview');
  // Opens on TODAY, not the last 7 days: the report an owner opens mid-service
  // is today's. The API resolves 'today' to the open business day, so this
  // lands on the same period Analytics shows.
  const [period, setPeriod] = useState('today');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [filters, setFilters] = useState({ businessDayId: '', employeeId: '', categoryId: '', foodGroup: '', paymentMethod: '', orderType: '', search: '' });
  const [searchDraft, setSearchDraft] = useState('');
  const [options, setOptions] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ tab, period });
    if (period === 'custom' && custom.start && custom.end) {
      params.set('startDate', custom.start);
      params.set('endDate', custom.end);
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('withOptions', '1');
    return params.toString();
  }, [tab, period, custom, filters]);

  const load = useCallback(async () => {
    if (period === 'custom' && (!custom.start || !custom.end)) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('pos_token');
      const res = await fetch(`/api/admin/reports?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'The report could not be built.');
      setData(body);
      if (body.options) setOptions(body.options);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query, period, custom.start, custom.end]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => {
    setFilters({ businessDayId: '', employeeId: '', categoryId: '', foodGroup: '', paymentMethod: '', orderType: '', search: '' });
    setSearchDraft('');
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const tabGroups = useMemo(() => tabGroupsFor(data?.allowedTabs), [data?.allowedTabs]);
  /*
   * The server says which filters this tab actually binds. Until the first
   * response lands, assume all are live so the bar does not flicker disabled.
   */
  const supported = data?.supportedFilters || null;
  const filterEnabled = useCallback((key) => !supported || supported.includes(key), [supported]);
  const filterDisabledReason = data?.filterUnavailableReason
    || 'This report has nothing for that filter to match on.';
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const activeKind = KINDS[activeTab.kind];

  /*
   * "Everything is zero" and "we could not load this" look identical to an
   * owner unless the page says which it is. A report is empty when no headline
   * figure has a value and no detail row came back.
   */
  const isEmptyReport = useMemo(() => {
    if (!data) return false;
    const tables = data.tables || (data.table ? [data.table] : []);
    const anyRows = tables.some((t) => (t.rows?.length || 0) > 0);
    const anyKpi = (data.kpis || []).some((k) => (typeof k.value === 'number' ? k.value !== 0 : Boolean(k.value)));
    return !anyRows && !anyKpi;
  }, [data]);

  /** Re-fetch this tab with the detail caps lifted. */
  const fetchFullTab = useCallback(async () => {
    const token = localStorage.getItem('pos_token');
    const res = await fetch(`/api/admin/reports?${query}&export=1`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'The export could not be built.');
    return body;
  }, [query]);

  /** Rows for one table, uncapped — used by that table's own CSV button. */
  const fetchFullTable = useCallback(
    async (tableId) => {
      const body = await fetchFullTab();
      const all = body.tables || (body.table ? [{ id: 'detail', ...body.table }] : []);
      return (all.find((t) => t.id === tableId) || all[0])?.rows || [];
    },
    [fetchFullTab]
  );

  /**
   * Export the whole active tab: KPIs, every chart series and every table.
   * Pulls the uncapped payload first so a download is never the truncated view.
   */
  const exportTab = async () => {
    if (!data) return;
    let full = data;
    try {
      full = await fetchFullTab();
    } catch {
      // Fall back to what is on screen rather than failing the download.
    }
    const blob = new Blob([buildReportWorkbook({
      tab,
      tabLabel: TABS.find((t) => t.id === tab)?.label || tab,
      period,
      filters,
      data: full,
    })], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tab}-report-${data.range?.start || 'export'}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{activeTab.label} Report</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${activeKind.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeKind.dot}`} />
                {activeKind.label}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-600">{activeTab.blurb}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4 shrink-0" />
              {data?.range?.label || 'Choose a date range to begin'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportTab}
            disabled={!data}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export {activeTab.label}
          </button>
        </div>
      </header>

      <div className="space-y-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
        {/* Shared filter bar — applies to whichever tab is active */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  period === p.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            {period === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <DateInput value={custom.start} onChange={(v) => setCustom({ ...custom, start: v })} className={selectClass()} />
                <span className="text-sm text-gray-400">to</span>
                <DateInput value={custom.end} onChange={(v) => setCustom({ ...custom, end: v })} className={selectClass()} />
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <select value={filters.businessDayId} onChange={(e) => setFilters({ ...filters, businessDayId: e.target.value })} disabled={!filterEnabled('businessDayId')} title={filterEnabled('businessDayId') ? undefined : filterDisabledReason} className={selectClass(filterEnabled('businessDayId'))}>
              <option value="">Calendar date range</option>
              {(options?.businessDays || []).map((day) => <option key={day.id} value={day.id}>Business Day {String(day.business_date).slice(0, 10)} · {day.status}</option>)}
            </select>
            <select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })} disabled={!filterEnabled('employeeId')} title={filterEnabled('employeeId') ? undefined : filterDisabledReason} className={selectClass(filterEnabled('employeeId'))}>
              <option value="">All employees</option>
              {(options?.employees || []).map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {e.role}</option>
              ))}
            </select>
            <select value={filters.foodGroup} onChange={(e) => setFilters({ ...filters, foodGroup: e.target.value })} disabled={!filterEnabled('foodGroup')} title={filterEnabled('foodGroup') ? undefined : filterDisabledReason} className={selectClass(filterEnabled('foodGroup'))}>
              <option value="">All master categories</option>
              {(options?.foodGroups || []).map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })} disabled={!filterEnabled('categoryId')} title={filterEnabled('categoryId') ? undefined : filterDisabledReason} className={selectClass(filterEnabled('categoryId'))}>
              <option value="">All categories</option>
              {(options?.categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={filters.paymentMethod} onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })} disabled={!filterEnabled('paymentMethod')} title={filterEnabled('paymentMethod') ? undefined : filterDisabledReason} className={selectClass(filterEnabled('paymentMethod'))}>
              <option value="">All payment methods</option>
              {(options?.paymentMethods || []).map((m) => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>
            <select value={filters.orderType} onChange={(e) => setFilters({ ...filters, orderType: e.target.value })} disabled={!filterEnabled('orderType')} title={filterEnabled('orderType') ? undefined : filterDisabledReason} className={selectClass(filterEnabled('orderType'))}>
              <option value="">All order types</option>
              {(options?.orderTypes || []).map((t) => (
                <option key={t} value={t}>{orderTypeLabel(t)}</option>
              ))}
            </select>
            <form
              onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, search: searchDraft.trim() }); }}
              className="relative min-w-[200px] flex-1"
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onBlur={() => setFilters((f) => ({ ...f, search: searchDraft.trim() }))}
                disabled={!filterEnabled('search')}
                title={filterEnabled('search') ? undefined : filterDisabledReason}
                placeholder={filterEnabled('search') ? 'Search bills, orders, tables…' : 'Search not available on this report'}
                className={`h-10 w-full rounded-lg border pl-9 pr-3 text-sm ${filterEnabled('search') ? 'border-gray-300 text-gray-900' : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'}`}
              />
            </form>
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <RotateCcw className="h-3.5 w-3.5" /> Clear {activeFilterCount}
              </button>
            )}
          </div>
        </div>

        {/* Tab bar — grouped by report kind, horizontally scrollable on mobile */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max min-w-max items-stretch gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {tabGroups.map((group, groupIndex) => (
              <div key={group.kind} className={`flex shrink-0 items-center gap-1 ${groupIndex ? 'ml-1 border-l border-gray-200 pl-2' : ''}`}>
                <span className="hidden shrink-0 select-none whitespace-nowrap pr-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 lg:inline">
                  {group.label}
                </span>
                {group.tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    title={t.blurb}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                      tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${KINDS[t.kind].dot} ${tab === t.id ? '' : 'opacity-60'}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {period === 'custom' && (!custom.start || !custom.end) && (
          <p className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Pick a start and end date above to build this report.
          </p>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error} <button type="button" onClick={load} className="ml-2 font-semibold underline">Try again</button>
          </div>
        )}

        {loading && !data && <ReportSkeleton />}

        {data && (
          <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <AppliedScope
              data={data}
              filters={filters}
              options={options}
              onClearFilter={(key) => {
                if (key === 'search') setSearchDraft('');
                setFilters((f) => ({ ...f, [key]: '' }));
              }}
            />
            {isEmptyReport ? (
              <NothingHappened
                tabLabel={activeTab.label}
                range={data.range}
                hasFilters={activeFilterCount > 0}
                onClearFilters={resetFilters}
              />
            ) : (
              <QuickChips chips={data.chips} />
            )}
            <KpiCards kpis={data.kpis} groups={data.kpiGroups} />
            <TabCharts tab={tab} data={data} />
            <BusinessInsights insights={data.insights} />
            {/* The same exception-log component the Analytics screen renders,
                from the same builder, so the two can never disagree. */}
            {data.orderOperations && (
              <div className="mt-6">
                <AllChanges report={data.orderOperations} />
              </div>
            )}
            {data.channelMix && (
              <div className="mt-6">
                <ChannelMix data={data.channelMix} className="overflow-hidden rounded-xl" />
              </div>
            )}
            {/* Finance tab only — the drawer count is a cash-position figure,
                not something the Menu or Reservations tabs ask about. Same card
                the Summary Report prints. Rendered unconditionally within that
                tab: a period with no counted close says so in the card rather
                than dropping out of the report. */}
            {/* Rendered off the DATA, not off the tab name: an admin gets these
                on Finance, a cashier gets the same cards on Sales because that
                is the tab their role can open. One condition, no role logic in
                the client. */}
            {data.moneyPosition && (
              <>
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <MoneyPosition data={data.moneyPosition || {}} className="overflow-hidden rounded-xl" />
                  <CashFlowCard data={data.cashFlow || {}} className="overflow-hidden rounded-xl" />
                </div>
                <div className="mt-6">
                  <CountedCash data={data.cashReconciliation || {}} className="overflow-hidden rounded-xl" />
                </div>
                <div className="mt-6">
                  <DigitalReceipts data={data.digitalReceipts || {}} className="overflow-hidden rounded-xl" />
                </div>
              </>
            )}
            {(data.tables || (data.table ? [{ id: 'detail', ...data.table }] : [])).map((t) => (
              <DataTable
                key={t.id}
                title={t.title || 'Details'}
                columns={t.columns}
                rows={t.rows}
                empty={t.empty}
                truncated={t.truncated}
                limit={t.limit}
                onExportAll={() => fetchFullTable(t.id)}
                csvName={`${tab}-${t.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function humanKey(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatExportCell(value, type) {
  // Must match the screen exactly. `new Date('2026-08-24 19:30:00')` reads a
  // bare SQLite timestamp as *browser-local* time, so the workbook used to show
  // times offset from the table it was exported from (and offset differently
  // for each viewer). formatNepalDateTime applies the same UTC-then-Kathmandu
  // rule the DataTable and CSV export use.
  if (type === 'datetime' && value) return formatNepalDateTime(value);
  return value ?? '';
}

function tableHtml({ title, headers, rows }) {
  return `
    <tr></tr>
    <tr><td colspan="${Math.max(1, headers.length)}" style="font-weight:bold;background:#d9eaf7">${escapeHtml(title)}</td></tr>
    <tr>${headers.map((header) => `<th style="font-weight:bold;background:#eeeeee">${escapeHtml(header)}</th>`).join('')}</tr>
    ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
  `;
}

function flattenObjectRows(object, prefix = '') {
  return Object.entries(object || {}).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} ${humanKey(key)}` : humanKey(key);
    if (value && typeof value === 'object' && !Array.isArray(value)) return flattenObjectRows(value, label);
    return [[label, value]];
  });
}

function buildReportWorkbook({ tabLabel, period, filters, data }) {
  const range = data.range || {};
  const activeFilters = Object.entries(filters || {}).filter(([, value]) => value);
  const tables = data.tables || (data.table ? [{ id: 'detail', ...data.table }] : []);
  const sections = [];

  sections.push(`<tr><td colspan="12" style="font-size:20px;font-weight:bold">${escapeHtml(tabLabel)} Report</td></tr>`);
  sections.push(`<tr><td style="font-weight:bold">Report</td><td>${escapeHtml(tabLabel)}</td></tr>`);
  sections.push(`<tr><td style="font-weight:bold">Period</td><td>${escapeHtml(range.label || period)}</td></tr>`);
  sections.push(`<tr><td style="font-weight:bold">Date Range</td><td>${escapeHtml(range.start || '')}</td><td>${escapeHtml(range.end || '')}</td></tr>`);
  sections.push(`<tr><td style="font-weight:bold">Exported At</td><td>${escapeHtml(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' }))} (Asia/Kathmandu)</td></tr>`);

  if (activeFilters.length) {
    sections.push(tableHtml({ title: 'Active Filters', headers: ['Filter', 'Value'], rows: activeFilters.map(([key, value]) => [humanKey(key), value]) }));
  }
  sections.push(tableHtml({
    title: 'KPI Summary',
    headers: ['Metric', 'Value', 'Format', 'Detail'],
    rows: (data.kpis || []).map((kpi) => [kpi.label, kpi.value ?? '', kpi.format || '', kpi.sub || '']),
  }));
  Object.entries(data.charts || {}).forEach(([name, series]) => {
    sections.push(tableHtml({
      title: `${humanKey(name)} Data`,
      headers: ['Label', 'Value', 'Detail'],
      rows: (series || []).map((row) => [row.sub || row.label, row.value ?? '', row.meta || '']),
    }));
  });
  if (data.insights?.length) {
    sections.push(tableHtml({
      title: 'Business Insights',
      headers: ['Title', 'Insight', 'Tone'],
      rows: data.insights.map((row) => [row.title, row.body, row.tone || '']),
    }));
  }
  if (data.reconciliation) {
    sections.push(tableHtml({ title: 'Reconciliation', headers: ['Metric', 'Value'], rows: flattenObjectRows(data.reconciliation) }));
  }
  tables.forEach((table) => {
    const columns = table.columns || [];
    sections.push(tableHtml({
      title: table.title || humanKey(table.id || 'Detail'),
      headers: columns.map((column) => column.label),
      rows: (table.rows || []).map((row) => columns.map((column) => formatExportCell(row[column.key], column.type))),
    }));
  });
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${sections.join('')}</table></body></html>`;
}

/**
 * What this report is currently showing, in words: the exact dates, every
 * filter that is narrowing it, and a warning when a detail table was capped.
 * This replaced a strip of KPI/chart/table counts — a number an owner has no
 * use for, in the slot directly under the headline figures.
 */
function AppliedScope({ data, filters, options, onClearFilter }) {
  const tables = data.tables || (data.table ? [data.table] : []);
  const capped = tables.filter((table) => table.truncated);

  const describe = (key, value) => {
    if (key === 'businessDayId') {
      const day = (options?.businessDays || []).find((d) => String(d.id) === String(value));
      return day ? `${String(day.business_date).slice(0, 10)} (${day.status})` : `#${value}`;
    }
    if (key === 'employeeId') {
      return (options?.employees || []).find((e) => String(e.id) === String(value))?.name || `#${value}`;
    }
    if (key === 'categoryId') {
      return (options?.categories || []).find((c) => String(c.id) === String(value))?.name || `#${value}`;
    }
    if (key === 'foodGroup') {
      return (options?.foodGroups || []).find((g) => g.id === value)?.label || value;
    }
    return String(value);
  };

  const active = Object.entries(filters || {}).filter(([, value]) => value);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Showing</span>
        <span className="font-medium text-gray-900">
          {data.range?.start === data.range?.end
            ? data.range?.start
            : `${data.range?.start} to ${data.range?.end}`}
        </span>
        {active.length === 0 ? (
          <span className="text-gray-500">· no filters applied</span>
        ) : (
          <>
            <span className="text-gray-400">·</span>
            {active.map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => onClearFilter(key)}
                title={`Remove the ${FILTER_LABELS[key] || key} filter`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-2.5 pr-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                <span className="text-gray-500">{FILTER_LABELS[key] || key}:</span>
                {describe(key, value)}
                <X className="h-3 w-3 text-gray-400" />
              </button>
            ))}
          </>
        )}
      </div>
      {capped.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 border-t border-gray-100 pt-2.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {capped.map((t) => t.title).join(', ')} {capped.length === 1 ? 'is' : 'are'} showing the most
            recent rows only. Totals and charts above cover the whole period; use Export or the table&rsquo;s
            CSV button for every row.
          </span>
        </p>
      )}
    </div>
  );
}

/** Nothing traded in this window — say so, rather than showing a wall of Rs 0. */
function NothingHappened({ tabLabel, range, hasFilters, onClearFilters }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <Calendar className="mx-auto h-8 w-8 text-gray-300" />
      <h2 className="mt-3 text-base font-semibold text-gray-900">
        No {tabLabel.toLowerCase()} activity in this period
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500">
        Nothing was recorded between {range?.start} and {range?.end}
        {hasFilters ? ' that matches the filters you have applied' : ''}. The zeros below are real, not a
        loading error &mdash; try a wider date range
        {hasFilters ? ' or clear the filters' : ''}.
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
}

/** Shape of the report, not a bare spinner — the page does not jump on load. */
function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Building your report">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="mt-3 h-6 w-28 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      <div className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-tab chart layouts — one chart per card, plenty of whitespace.   */
/* ------------------------------------------------------------------ */

function TabCharts({ tab, data }) {
  const c = data.charts || {};

  if (tab === 'overview') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Revenue Trend" hint="Settled bills per day" isEmpty={allZero(c.revenueTrend)} empty="No revenue was taken during the selected period.">
            <TrendChart data={c.revenueTrend} color="blue" />
          </ChartCard>
          <ChartCard title="Profit Trend" hint="Revenue less estimated food cost" isEmpty={allZero(c.profitTrend)} empty="There is no trading activity to derive profit from yet.">
            <TrendChart data={c.profitTrend} color="emerald" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Top Selling Items" isEmpty={!c.topItems?.length} empty="No menu items were sold during the selected period.">
            <RankBars data={c.topItems} color="slate" />
          </ChartCard>
          <ChartCard title="Inventory Alerts" isEmpty={!data.alerts?.length} empty="Every tracked raw material is above its reorder level.">
            <div className="space-y-1">
              {(data.alerts || []).map((a, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-50 py-2.5 last:border-0">
                  <span className="flex items-center gap-2.5 text-sm font-medium text-gray-800">
                    <span className={`h-2 w-2 rounded-full ${a.status === 'out' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    {a.name}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${a.status === 'out' ? 'text-red-600' : 'text-amber-600'}`}>
                    {a.quantity} {a.unit}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'sales') {
    return (
      <>
        <ChartCard title="Revenue Trend" hint="Settled bills per day" isEmpty={allZero(c.revenueTrend)} empty="No revenue was taken during the selected period.">
          <TrendChart data={c.revenueTrend} color="blue" />
        </ChartCard>
        <ChartGrid>
          <ChartCard title="Sales by Hour" isEmpty={allZero(c.byHour)} empty="No bills were settled at any hour in this range.">
            <BarChart data={c.byHour} color="violet" />
          </ChartCard>
          <ChartCard title="Sales by Day of Week" isEmpty={allZero(c.byDay)} empty="There is not enough trading history to compare days.">
            <BarChart data={c.byDay} color="teal" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Sales by Master Category" hint="Food, Beverages, Tobacco…" isEmpty={!c.byGroup?.length} empty="No items were sold in this period.">
            <DonutBlock rows={c.byGroup} centerLabel="Sales" />
          </ChartCard>
          <ChartCard title="Sales by Category" isEmpty={!c.byCategory?.length} empty="No categorised items were sold in this period.">
            <RankBars data={c.byCategory} color="blue" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Sales by Payment Method" isEmpty={!c.byPayment?.length} empty="No payments were recorded against bills in this period.">
            <DonutBlock rows={c.byPayment} centerLabel="Paid" />
          </ChartCard>
          <ChartCard title="Sales by Waiter" isEmpty={!c.byWaiter?.length} empty="No orders in this period were assigned to a waiter.">
            <RankBars data={c.byWaiter} color="emerald" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Sales by Order Type" isEmpty={!c.byOrderType?.length} empty="No orders were placed in this period.">
            <DonutBlock rows={c.byOrderType} centerLabel="Sales" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'finance') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Expense Breakdown" hint="By category" isEmpty={!c.expenseBreakdown?.length} empty="No expenses were logged during the selected period.">
            <DonutBlock rows={c.expenseBreakdown} centerLabel="Spend" />
          </ChartCard>
          <ChartCard title="Profit Trend" hint="Revenue less expenses, per day" isEmpty={allZero(c.profitTrend)} empty="There is no revenue or expense activity to plot.">
            <TrendChart data={c.profitTrend} color="emerald" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Monthly Revenue" hint="Whole trading history, not limited by the date filter" isEmpty={!c.monthlyRevenue?.length} empty="No bills have ever been settled.">
            <TrendChart data={c.monthlyRevenue} color="blue" />
          </ChartCard>
          <ChartCard title="Expense Trend" isEmpty={allZero(c.expenseTrend)} empty="No expenses were logged during the selected period.">
            <TrendChart data={c.expenseTrend} color="red" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'orders') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Orders per Hour" isEmpty={allZero(c.perHour)} empty="No orders were placed in the selected period.">
            <BarChart data={c.perHour} color="violet" format="number" />
          </ChartCard>
          <ChartCard title="Order Types" isEmpty={!c.orderTypes?.length} empty="No orders were placed in the selected period.">
            <RankBars data={c.orderTypes} color="amber" format="number" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Preparation Time" hint="Kitchen tickets, printed to completed" isEmpty={allZero(c.prepTime)} empty="No kitchen ticket in this period was marked complete.">
            <BarChart data={c.prepTime} color="teal" format="number" />
          </ChartCard>
          <ChartCard title="Serving Time" hint="Order placed to bill settled" isEmpty={allZero(c.serveTime)} empty="No order in this period was billed and settled.">
            <BarChart data={c.serveTime} color="blue" format="number" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'menu') {
    return (
      <>
        <ChartCard title="Top Selling Items" hint="By revenue" isEmpty={!c.topItems?.length} empty="No menu items were sold during the selected period.">
          <RankBars data={c.topItems} color="slate" />
        </ChartCard>
        <ChartGrid>
          <ChartCard title="Master Category Performance" hint="Food, Beverages, Tobacco…" isEmpty={!c.groupPerformance?.length} empty="No items were sold in this period.">
            <RankBars data={c.groupPerformance} color="slate" />
          </ChartCard>
          <ChartCard title="Menu Category Performance" isEmpty={!c.categoryPerformance?.length} empty="No categorised items were sold in this period.">
            <RankBars data={c.categoryPerformance} color="blue" />
          </ChartCard>
        </ChartGrid>
        <ChartCard title="Average Selling Price" hint="Realised price per item, by category" isEmpty={!c.avgPrice?.length} empty="Nothing was sold, so there is no realised price to average.">
          <RankBars data={c.avgPrice} color="teal" />
        </ChartCard>
        <ChartCard title="Popularity vs Profit" hint="Each dot is a menu item — top right sells well and earns well" isEmpty={!c.matrix?.length} empty="No menu items were sold, so there is nothing to plot.">
          <ScatterChart data={c.matrix} xLabel="Quantity sold" yLabel="Margin %" />
        </ChartCard>
      </>
    );
  }

  if (tab === 'inventory') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Inventory Consumption" hint="Value deducted by orders" isEmpty={allZero(c.consumption)} empty="No stock has been deducted by orders in this period.">
            <TrendChart data={c.consumption} color="blue" />
          </ChartCard>
          <ChartCard title="Purchase Trend" hint="Value received into stock" isEmpty={allZero(c.purchases)} empty="No deliveries have been received in this period.">
            <TrendChart data={c.purchases} color="teal" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Wastage Trend" isEmpty={allZero(c.wastage)} empty="No wastage has been logged in this period.">
            <TrendChart data={c.wastage} color="red" />
          </ChartCard>
          <ChartCard title="Stock Movement" hint="Quantity moved, by movement type" isEmpty={!c.movementTypes?.length} empty="No inventory movement has been recorded in this period.">
            <RankBars data={c.movementTypes} color="violet" format="number" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'customers') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Customer Growth" hint="New profiles created per day" isEmpty={allZero(c.growth)} empty="No new customer profile was created in this period.">
            <TrendChart data={c.growth} color="violet" format="number" />
          </ChartCard>
          <ChartCard title="Visit Frequency" hint="How many customers sit in each visit band" isEmpty={allZero(c.frequency)} empty="No customer profiles exist yet.">
            <BarChart data={c.frequency} color="blue" format="number" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Revenue by Customer" hint="Lifetime spend on the customer profile" isEmpty={!c.revenueByCustomer?.length} empty="No customer has any recorded spend.">
            <RankBars data={c.revenueByCustomer} color="slate" />
          </ChartCard>
          <ChartCard title="Top Customers" hint="By recorded visits" isEmpty={!c.topCustomers?.length} empty="No customer visits have been recorded.">
            <RankBars data={c.topCustomers} color="emerald" format="number" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'employees') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Sales by Waiter" isEmpty={!c.salesByWaiter?.length} empty="No orders in this period were assigned to a waiter.">
            <RankBars data={c.salesByWaiter} color="emerald" />
          </ChartCard>
          <ChartCard title="Order Count by Waiter" isEmpty={!c.orderCount?.length} empty="No orders in this period were assigned to a waiter.">
            <RankBars data={c.orderCount} color="blue" format="number" />
          </ChartCard>
        </ChartGrid>
        <ChartCard title="Kitchen Speed" hint="Average minutes per completed ticket, per day" isEmpty={allZero(c.kitchenSpeed)} empty="No kitchen ticket in this period was marked complete.">
          <TrendChart data={c.kitchenSpeed} color="teal" format="minutes" />
        </ChartCard>
      </>
    );
  }

  if (tab === 'tables') {
    return (
      <>
        <ChartGrid>
          <ChartCard title="Table Usage" hint="Settled orders per table" isEmpty={allZero(c.usage)} empty="No table took a settled order in this period.">
            <BarChart data={c.usage} color="blue" format="number" />
          </ChartCard>
          <ChartCard title="Peak Occupancy" hint="Orders opened per hour" isEmpty={allZero(c.peakOccupancy)} empty="No orders were opened in this period.">
            <BarChart data={c.peakOccupancy} color="violet" format="number" />
          </ChartCard>
        </ChartGrid>
        <ChartCard title="Average Duration" hint="Minutes from order placed to bill settled, per table" isEmpty={allZero(c.duration)} empty="No sitting in this period ran through to a settled bill.">
          <BarChart data={c.duration} color="teal" format="minutes" />
        </ChartCard>
      </>
    );
  }

  if (tab === 'reservations') {
    return (
      <>
        <ChartCard title="Reservation Trend" isEmpty={allZero(c.trend)} empty="No reservations were booked for the selected period.">
          <TrendChart data={c.trend} color="violet" format="number" />
        </ChartCard>
        <ChartGrid>
          <ChartCard title="Arrival Hours" isEmpty={!c.arrivalHours?.length} empty="No reservation in this period has an arrival time on it.">
            <BarChart data={c.arrivalHours} color="blue" format="number" />
          </ChartCard>
          <ChartCard title="Busy Days" isEmpty={allZero(c.busyDays)} empty="No reservations were booked for the selected period.">
            <BarChart data={c.busyDays} color="amber" format="number" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  if (tab === 'suppliers') {
    return (
      <>
        <ChartCard title="Purchases Over Time" isEmpty={allZero(c.overTime)} empty="No purchases were recorded against a supplier in this period.">
          <TrendChart data={c.overTime} color="teal" />
        </ChartCard>
        <ChartGrid>
          <ChartCard title="Supplier Spend" isEmpty={!c.spend?.length} empty="No purchases were recorded against a supplier in this period.">
            <RankBars data={c.spend} color="slate" />
          </ChartCard>
          <ChartCard title="Top Suppliers" hint="By number of purchases" isEmpty={!c.topSuppliers?.length} empty="No supplier has been purchased from in this period.">
            <RankBars data={c.topSuppliers} color="blue" format="number" />
          </ChartCard>
        </ChartGrid>
      </>
    );
  }

  return null;
}

