'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Calendar, RotateCcw, Search } from 'lucide-react';
import { DataTable } from '@/components/admin/report-kit';
import { orderTypeLabel } from '@/lib/order-types.js';
import DateInput from '@/components/ui/date-input.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', blurb: 'One daily table joining sales, collections, costs, purchases, expenses and profit.' },
  { id: 'sales', label: 'Sales', blurb: 'Invoices, payment splits, categories and daily sales records.' },
  { id: 'finance', label: 'Finance', blurb: 'Expenses, daily profit, tax and VAT records.' },
  { id: 'expenses', label: 'Expenses', blurb: 'Every operating expense with payee, category, payment method, receipt and source details.' },
  { id: 'purchases', label: 'Purchases', blurb: 'Received invoices with suppliers, payment methods, item lines, quantities and costs.' },
  { id: 'suppliers', label: 'Suppliers', blurb: 'Purchase history and supplier-level spending records.' },
  { id: 'orders', label: 'Orders', blurb: 'Order progress, kitchen cancellations and voided bill records.' },
  { id: 'changes', label: 'Cancellations & Changes', blurb: 'Cancelled orders and items, voids, refunds, revisions and discounts.' },
  { id: 'inventory', label: 'Inventory', blurb: 'Current stock, movements, purchases and low-stock records.' },
  { id: 'employees', label: 'Employees', blurb: 'Employee service and settlement performance records.' },
  { id: 'tables', label: 'Tables', blurb: 'Table performance and served-order records.' },
  { id: 'reservations', label: 'Reservations', blurb: 'Reservation, guest, status, table and waiting-time records.' },
  { id: 'menu', label: 'Menu', blurb: 'Item sales, food cost, profit and margin records.' },
  { id: 'customers', label: 'Customers', blurb: 'Customer visits, spending and lifetime-value records.' },
];

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

const ALL_FILTERS = ['businessDayId', 'employeeId', 'categoryId', 'foodGroup', 'paymentMethod', 'orderType', 'search'];
const TAB_FILTERS = {
  overview: ALL_FILTERS,
  sales: ALL_FILTERS,
  finance: ALL_FILTERS,
  expenses: ALL_FILTERS,
  purchases: ['businessDayId', 'employeeId', 'paymentMethod', 'search'],
  orders: ALL_FILTERS,
  menu: ALL_FILTERS,
  customers: ALL_FILTERS,
  employees: ALL_FILTERS,
  tables: ALL_FILTERS,
  inventory: ['businessDayId', 'employeeId', 'search'],
  reservations: ['businessDayId', 'search'],
  suppliers: ['businessDayId', 'paymentMethod', 'search'],
  changes: ['businessDayId'],
};

const EMPTY_FILTERS = {
  businessDayId: '', employeeId: '', categoryId: '', foodGroup: '',
  paymentMethod: '', orderType: '', search: '',
};

const controlClass = 'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700';

export default function ReportsPage() {
  const [tab, setTab] = useState('overview');
  const [periods, setPeriods] = useState({});
  const [customRanges, setCustomRanges] = useState({});
  const [filterSets, setFilterSets] = useState({});
  const [searchDrafts, setSearchDrafts] = useState({});
  const [options, setOptions] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((item) => item.id === requested)) setTab(requested);
  }, []);

  const period = periods[tab] || 'today';
  const custom = customRanges[tab] || { start: '', end: '' };
  const filters = filterSets[tab] || EMPTY_FILTERS;
  const searchDraft = searchDrafts[tab] ?? filters.search ?? '';
  const supported = TAB_FILTERS[tab] || ALL_FILTERS;
  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];
  const activeFilterCount = supported.filter((key) => Boolean(filters[key])).length;

  const setPeriod = (value) => {
    setPeriods((current) => ({ ...current, [tab]: value }));
    setFilterSets((current) => ({
      ...current,
      [tab]: { ...(current[tab] || EMPTY_FILTERS), businessDayId: '' },
    }));
  };
  const setCustom = (next) => setCustomRanges((current) => ({ ...current, [tab]: next }));
  const setFilter = (key, value) => setFilterSets((current) => ({
    ...current,
    [tab]: { ...(current[tab] || EMPTY_FILTERS), [key]: value },
  }));
  const setSearchDraft = (value) => setSearchDrafts((current) => ({ ...current, [tab]: value }));
  const resetFilters = () => {
    setFilterSets((current) => ({ ...current, [tab]: { ...EMPTY_FILTERS } }));
    setSearchDrafts((current) => ({ ...current, [tab]: '' }));
  };

  const query = useMemo(() => {
    const params = new URLSearchParams({ tab, period, withOptions: '1' });
    if (period === 'custom' && custom.start && custom.end) {
      params.set('startDate', custom.start);
      params.set('endDate', custom.end);
    }
    supported.forEach((key) => {
      if (filters[key]) params.set(key, filters[key]);
    });
    return params.toString();
  }, [tab, period, custom.start, custom.end, filters, supported]);

  const customMissing = period === 'custom' && (!custom.start || !custom.end);
  const load = useCallback(async () => {
    if (customMissing) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('pos_token');
      const response = await fetch(`/api/admin/reports?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The report could not be built.');
      setData(body);
      if (body.options) setOptions(body.options);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [customMissing, query]);

  useEffect(() => { load(); }, [load]);

  const currentData = data?.tab === tab ? data : null;
  const visibleTabs = useMemo(() => {
    const allowed = data?.allowedTabs;
    return allowed?.length ? TABS.filter((item) => allowed.includes(item.id)) : TABS;
  }, [data?.allowedTabs]);
  const tables = useMemo(() => {
    if (!currentData) return [];
    return currentData.tables || (currentData.table ? [{ id: 'detail', ...currentData.table }] : []);
  }, [currentData]);
  const recordTables = tables;
  const shownRecords = recordTables.reduce((total, table) => total + (table.rows?.length || 0), 0);

  const fetchFullTable = useCallback(async (tableId) => {
    const token = localStorage.getItem('pos_token');
    const response = await fetch(`/api/admin/reports?${query}&export=1`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The CSV could not be built.');
    const fullTables = body.tables || (body.table ? [{ id: 'detail', ...body.table }] : []);
    return (fullTables.find((item) => item.id === tableId) || fullTables[0])?.rows || [];
  }, [query]);

  const selectTab = (nextTab) => {
    setTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.replaceState({}, '', url);
  };

  return (
    <AdminLayout>
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Detailed records, filters and CSV exports. Visual analysis stays in Analytics.</p>
      </header>

      <main className="min-h-screen space-y-5 bg-gray-50 p-4 sm:p-6 lg:p-8">
        <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Report tabs">
          <div className="flex w-max min-w-max gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium ${tab === item.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">{activeTab.label} records</h2>
                <p className="mt-0.5 text-sm text-gray-500">{activeTab.blurb}</p>
              </div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                {currentData?.range?.label || 'Select the reporting period below'}
              </p>
            </div>
        </section>

        {customMissing && <section className="rounded-2xl border border-gray-200 bg-white shadow-sm"><ReportFilters period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} filters={filters} setFilter={setFilter} supported={supported} options={options} searchDraft={searchDraft} setSearchDraft={setSearchDraft} activeFilterCount={activeFilterCount} resetFilters={resetFilters} /></section>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={load} className="ml-2 font-semibold underline">Try again</button></div>}
        {loading && !currentData && !customMissing && <RecordsSkeleton />}

        {currentData && !customMissing && (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              <span><strong className="font-semibold text-gray-950">{shownRecords.toLocaleString()}</strong> records shown</span>
              <span><strong className="font-semibold text-gray-950">{recordTables.length}</strong> {recordTables.length === 1 ? 'table' : 'tables'}</span>
              {activeFilterCount > 0 && <span><strong className="font-semibold text-gray-950">{activeFilterCount}</strong> active {activeFilterCount === 1 ? 'filter' : 'filters'}</span>}
              <span className="text-xs text-gray-400">Each CSV follows the filters and table search currently applied.</span>
            </div>

            {!recordTables.length ? (
              <EmptyMessage>No {activeTab.label.toLowerCase()} records match this period and these filters.</EmptyMessage>
            ) : null}

            {recordTables.map((table) => (
              <DataTable
                key={`${tab}-${table.id}`}
                title={table.title || `${activeTab.label} details`}
                columns={table.columns}
                rows={table.rows || []}
                empty={table.empty || 'No records match this report.'}
                truncated={table.truncated}
                limit={table.limit}
                onExportAll={() => fetchFullTable(table.id)}
                csvName={`${tab}-${table.id}-${currentData.range?.start || 'records'}`}
                toolbar={<ReportFilters period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} filters={filters} setFilter={setFilter} supported={supported} options={options} searchDraft={searchDraft} setSearchDraft={setSearchDraft} activeFilterCount={activeFilterCount} resetFilters={resetFilters} />}
                detailContext={{ tab, tableId: table.id, range: currentData.range, filters }}
              />
            ))}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}

function ReportFilters({
  period, setPeriod, custom, setCustom, filters, setFilter, supported, options,
  searchDraft, setSearchDraft, activeFilterCount, resetFilters,
}) {
  const enabled = (key) => supported.includes(key);
  return <div className="space-y-4 p-4 sm:p-5">
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Period</p>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((item) => <button key={item.id} type="button" onClick={() => setPeriod(item.id)} className={`rounded-lg px-3 py-2 text-sm font-medium ${period === item.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{item.label}</button>)}
        {period === 'custom' && <div className="flex flex-wrap items-center gap-2">
          <DateInput value={custom.start} onChange={(value) => setCustom({ ...custom, start: value })} className={controlClass} />
          <span className="text-sm text-gray-400">to</span>
          <DateInput value={custom.end} onChange={(value) => setCustom({ ...custom, end: value })} className={controlClass} />
        </div>}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
      {enabled('businessDayId') && <select value={filters.businessDayId} onChange={(event) => setFilter('businessDayId', event.target.value)} className={controlClass}>
        <option value="">Calendar date range</option>
        {(options?.businessDays || []).map((day) => <option key={day.id} value={day.id}>Business Day {String(day.business_date).slice(0, 10)} · {day.status}</option>)}
      </select>}
      {enabled('employeeId') && <select value={filters.employeeId} onChange={(event) => setFilter('employeeId', event.target.value)} className={controlClass}>
        <option value="">All employees</option>
        {(options?.employees || []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}
      </select>}
      {enabled('foodGroup') && <select value={filters.foodGroup} onChange={(event) => setFilter('foodGroup', event.target.value)} className={controlClass}>
        <option value="">All master categories</option>
        {(options?.foodGroups || []).map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
      </select>}
      {enabled('categoryId') && <select value={filters.categoryId} onChange={(event) => setFilter('categoryId', event.target.value)} className={controlClass}>
        <option value="">All categories</option>
        {(options?.categories || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>}
      {enabled('paymentMethod') && <select value={filters.paymentMethod} onChange={(event) => setFilter('paymentMethod', event.target.value)} className={controlClass}>
        <option value="">All payment methods</option>
        {(options?.paymentMethods || []).map((method) => <option key={method} value={method}>{method}</option>)}
      </select>}
      {enabled('orderType') && <select value={filters.orderType} onChange={(event) => setFilter('orderType', event.target.value)} className={controlClass}>
        <option value="">All order types</option>
        {(options?.orderTypes || []).map((type) => <option key={type} value={type}>{orderTypeLabel(type)}</option>)}
      </select>}
      {enabled('search') && <form onSubmit={(event) => { event.preventDefault(); setFilter('search', searchDraft.trim()); }} className="relative min-w-[210px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onBlur={() => setFilter('search', searchDraft.trim())} placeholder="Search these records…" className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-900" />
      </form>}
      {activeFilterCount > 0 && <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"><RotateCcw className="h-3.5 w-3.5" />Clear {activeFilterCount}</button>}
    </div>
  </div>;
}

function EmptyMessage({ children }) {
  return <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500">{children}</div>;
}

function RecordsSkeleton() {
  return <div className="space-y-5 animate-pulse"><div className="h-12 rounded-xl border border-gray-200 bg-white" /><div className="h-96 rounded-2xl border border-gray-200 bg-white" /></div>;
}
