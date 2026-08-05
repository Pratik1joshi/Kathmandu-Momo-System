'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Calendar, Download, RotateCcw, Search } from 'lucide-react';
import { toCsv } from '@/lib/csv';
import {
  QuickChips, KpiCards, ChartCard, ChartGrid, BarChart, TrendChart, RankBars,
  ScatterChart, BusinessInsights, DataTable, DataNotes,
} from '@/components/admin/report-kit';

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

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'finance', label: 'Finance' },
  { id: 'orders', label: 'Orders' },
  { id: 'menu', label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'customers', label: 'Customers' },
  { id: 'employees', label: 'Employees' },
  { id: 'tables', label: 'Tables' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'suppliers', label: 'Suppliers' },
];

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
];

const allZero = (series) => !series?.length || series.every((d) => !d.value);

function selectClass() {
  return 'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700';
}

export default function ReportsPage({ initialTab = 'overview', title = 'Reports', lockedTab = false }) {
  const [tab, setTab] = useState(initialTab);
  const [period, setPeriod] = useState('week');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [filters, setFilters] = useState({ employeeId: '', categoryId: '', paymentMethod: '', orderType: '', search: '' });
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
    setFilters({ employeeId: '', categoryId: '', paymentMethod: '', orderType: '', search: '' });
    setSearchDraft('');
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
    const sections = [];
    sections.push(`Report,${TABS.find((t) => t.id === tab)?.label}`);
    sections.push(`Period,${data.range?.label || period}`);
    sections.push('');
    sections.push(toCsv(['Metric', 'Value'], (full.kpis || []).map((k) => ({ Metric: k.label, Value: k.value ?? '' }))));
    Object.entries(full.charts || {}).forEach(([name, series]) => {
      sections.push('');
      sections.push(name);
      sections.push(toCsv(['Label', 'Value', 'Detail'], series.map((d) => ({ Label: d.sub || d.label, Value: d.value, Detail: d.meta || '' }))));
    });
    for (const t of full.tables || (full.table ? [{ ...full.table, title: 'Detail' }] : [])) {
      sections.push('');
      sections.push(t.title || 'Detail');
      sections.push(toCsv(t.columns.map((c) => c.label), t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.label, r[c.key] ?? ''])))));
    }
    const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tab}-report-${data.range?.start || 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              {data?.range?.label || 'Choose a date range to begin'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportTab}
            disabled={!data}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export {TABS.find((t) => t.id === tab)?.label}
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
                <input type="date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} className={selectClass()} />
                <span className="text-sm text-gray-400">to</span>
                <input type="date" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} className={selectClass()} />
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })} className={selectClass()}>
              <option value="">All employees</option>
              {(options?.employees || []).map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {e.role}</option>
              ))}
            </select>
            <select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })} className={selectClass()}>
              <option value="">All categories</option>
              {(options?.categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={filters.paymentMethod} onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })} className={selectClass()}>
              <option value="">All payment methods</option>
              {(options?.paymentMethods || []).map((m) => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>
            <select value={filters.orderType} onChange={(e) => setFilters({ ...filters, orderType: e.target.value })} className={selectClass()}>
              <option value="">All order types</option>
              {(options?.orderTypes || []).map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
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
                placeholder="Search bills, orders, tables…"
                className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-900"
              />
            </form>
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <RotateCcw className="h-3.5 w-3.5" /> Clear {activeFilterCount}
              </button>
            )}
          </div>
        </div>

        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:w-auto">
            {TABS.filter((t) => !lockedTab || t.id === initialTab).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
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

        {loading && !data && <p className="py-24 text-center text-sm text-gray-500">Building your report…</p>}

        {data && (
          <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
            <QuickChips chips={data.chips} />
            <KpiCards kpis={data.kpis} />
            <TabCharts tab={tab} data={data} />
            <BusinessInsights insights={data.insights} />
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
            <DataNotes notes={data.notes} />
          </div>
        )}
      </div>
    </AdminLayout>
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
          <ChartCard title="Sales by Category" isEmpty={!c.byCategory?.length} empty="No categorised items were sold in this period.">
            <RankBars data={c.byCategory} color="slate" />
          </ChartCard>
          <ChartCard title="Sales by Payment Method" isEmpty={!c.byPayment?.length} empty="No payments were recorded against bills in this period.">
            <RankBars data={c.byPayment} color="blue" />
          </ChartCard>
        </ChartGrid>
        <ChartGrid>
          <ChartCard title="Sales by Waiter" isEmpty={!c.byWaiter?.length} empty="No orders in this period were assigned to a waiter.">
            <RankBars data={c.byWaiter} color="emerald" />
          </ChartCard>
          <ChartCard title="Sales by Order Type" isEmpty={!c.byOrderType?.length} empty="No orders were placed in this period.">
            <RankBars data={c.byOrderType} color="amber" />
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
            <RankBars data={c.expenseBreakdown} color="amber" />
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
          <ChartCard title="Menu Category Performance" isEmpty={!c.categoryPerformance?.length} empty="No categorised items were sold in this period.">
            <RankBars data={c.categoryPerformance} color="blue" />
          </ChartCard>
          <ChartCard title="Average Selling Price" hint="Realised price per item, by category" isEmpty={!c.avgPrice?.length} empty="Nothing was sold, so there is no realised price to average.">
            <RankBars data={c.avgPrice} color="teal" />
          </ChartCard>
        </ChartGrid>
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
