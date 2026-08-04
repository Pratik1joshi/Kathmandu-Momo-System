'use client';

/**
 * Expenses, including the ones nobody typed.
 *
 * Purchases and wastage now generate their own expense rows (source_type +
 * source_id). The API returns 409 if you try to edit or delete one, so this
 * page never offers the action — it points at the record that owns the row
 * instead. That is the whole difference from the old page.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/admin-layout';
import { Paperclip, Pencil, Plus, Trash2, Truck, Trash } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { friendlyFromError, friendlyMessage } from '@/lib/friendly-message';
import { apiJsonRaw } from '@/lib/authed-fetch';
import DataGrid, { StatusBadge } from '@/components/admin/data-grid';
import useServerList from '@/lib/use-server-list';
import { KpiCards, ChartCard, ChartGrid, TrendChart, RankBars } from '@/components/admin/report-kit';
import LogExpenseModal, { EXPENSE_CATEGORIES } from '@/components/expenses/log-expense-modal';

/** Categories the automation writes; they never appear in the manual picker. */
const GENERATED_CATEGORY_LABELS = {
  inventory_purchase: 'Inventory purchase',
  inventory_loss: 'Inventory loss',
};

const SOURCE_META = {
  purchase: { label: 'Purchase', href: '/admin/purchases', Icon: Truck },
  wastage: { label: 'Wastage', href: '/admin/wastage', Icon: Trash },
};

function categoryLabel(value) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ||
    GENERATED_CATEGORY_LABELS[value] ||
    String(value || '').replace(/_/g, ' ')
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeFor(preset) {
  const now = new Date();
  if (preset === 'this_month') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  if (preset === 'last_month')
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  if (preset === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    return { from: fmt(new Date(now.getFullYear(), qStart, 1)), to: fmt(now) };
  }
  return { from: '', to: '' };
}

export default function ExpensesPage() {
  const { addToast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [modal, setModal] = useState(null); // { expense?, payroll? }

  const { from, to } = datePreset === 'custom' ? { from: customFrom, to: customTo } : rangeFor(datePreset);

  const filters = useMemo(
    () => ({ category: categoryFilter, origin: originFilter, from, to }),
    [categoryFilter, originFilter, from, to]
  );

  const {
    rows,
    extra,
    server,
    loading,
    reload: fetchExpenses,
  } = useServerList({
    url: '/api/admin/expenses',
    key: 'expenses',
    filters,
    initialSort: { key: 'purchase_date', dir: 'desc' },
    onError: (error) => addToast(friendlyFromError(error, 'load_failed')),
  });

  // Tiles and charts describe the whole filtered range and are aggregated in
  // SQL — totalling the fifty rows on screen would understate the spend.
  const summary = extra.summary;

  async function handleDelete(expense) {
    if (expense.source_type) return; // never offered, but belt and braces
    if (!confirm(`Delete “${expense.description}”?`)) return;
    const { ok, status, data } = await apiJsonRaw(`/api/admin/expenses?id=${expense.id}`, { method: 'DELETE' });
    if (ok) {
      addToast(friendlyMessage('delete_success'));
      fetchExpenses();
      return;
    }
    addToast(
      status === 409
        ? friendlyMessage('validation', { description: data.error })
        : friendlyFromError(data, 'delete_failed')
    );
  }

  const byCategory = useMemo(
    () => (summary?.byCategory || []).map((r) => ({ label: categoryLabel(r.category), value: r.total })),
    [summary]
  );

  const daily = useMemo(
    () => (summary?.daily || []).map((r) => ({ label: r.date.slice(5), sub: r.date, value: r.total })),
    [summary]
  );

  const columns = useMemo(
    () => [
      {
        key: 'purchase_date',
        label: 'Date',
        value: (e) => e.purchase_date || e.expense_date || '',
        render: (e) => String(e.purchase_date || e.expense_date || '').slice(0, 10) || '—',
      },
      {
        key: 'description',
        label: 'Description',
        wrap: true,
        className: 'text-gray-900 font-medium',
        render: (e) => {
          const meta = SOURCE_META[e.source_type];
          return (
            <div className="min-w-[220px]">
              <p>{e.description}</p>
              {meta && (
                <Link href={meta.href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">
                  <meta.Icon className="h-3 w-3" />
                  Generated from {meta.label} #{e.source_id}
                </Link>
              )}
            </div>
          );
        },
      },
      {
        key: 'category',
        label: 'Category',
        value: (e) => categoryLabel(e.category),
        render: (e) => <StatusBadge tone={e.source_type ? 'blue' : 'gray'}>{categoryLabel(e.category)}</StatusBadge>,
      },
      {
        key: 'amount',
        label: 'Amount',
        align: 'right',
        numeric: true,
        className: 'text-gray-900 font-medium',
        value: (e) => Number(e.amount || 0),
        render: (e) => `Rs ${Number(e.amount || 0).toFixed(2)}`,
      },
      {
        key: 'origin',
        label: 'Origin',
        value: (e) => (e.source_type ? 'Automatic' : 'Manual'),
        render: (e) =>
          e.source_type ? <StatusBadge tone="violet">Automatic</StatusBadge> : <StatusBadge tone="gray">Manual</StatusBadge>,
      },
      { key: 'payment_method', label: 'Method', render: (e) => <span className="capitalize">{String(e.payment_method || 'cash').replace('_', ' ')}</span> },
      { key: 'supplier', label: 'Paid to', render: (e) => e.supplier || <span className="text-gray-300">—</span> },
      { key: 'logged_by_name', label: 'Logged by', render: (e) => e.logged_by_name || <span className="text-gray-300">System</span> },
      {
        key: 'receipt_url',
        label: 'Receipt',
        sortable: false,
        render: (e) =>
          e.receipt_url ? (
            <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-900" aria-label="Open receipt">
              <Paperclip className="h-4 w-4" />
            </a>
          ) : (
            <span className="text-gray-300">—</span>
          ),
      },
    ],
    []
  );

  return (
    <AdminLayout>
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Expenses</h1>
            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              What you spent — including the purchases and wastage that book themselves.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setModal({ payroll: true })} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Plus className="h-4 w-4" /> Payroll
            </button>
            <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
              <Plus className="h-4 w-4" /> Log expense
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-5 bg-gray-50 p-4 sm:p-6 lg:p-8">
        <KpiCards
          kpis={[
            { key: 'total', label: 'Total spend', value: summary?.total || 0, format: 'currency', sub: `${plural(summary?.entries || 0, 'entry', 'entries')} in range` },
            { key: 'purchases', label: 'Inventory purchases', value: summary?.purchases || 0, format: 'currency', sub: 'Booked by deliveries' },
            { key: 'loss', label: 'Inventory loss', value: summary?.losses || 0, format: 'currency', sub: 'Booked by wastage' },
            { key: 'operating', label: 'Operating expenses', value: summary?.operating || 0, format: 'currency', sub: 'Entered by hand' },
          ]}
        />

        <div className="flex flex-wrap gap-2">
          {['this_month', 'last_month', 'quarter', 'custom'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDatePreset(p)}
              className={`h-9 rounded-lg px-3 text-sm font-medium ${
                datePreset === p ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'this_month' ? 'This month' : p === 'last_month' ? 'Last month' : p === 'quarter' ? 'Quarter to date' : 'Custom'}
            </button>
          ))}
          {datePreset === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-2 text-sm" aria-label="From" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-2 text-sm" aria-label="To" />
            </>
          )}
        </div>

        <ChartGrid>
          <ChartCard title="Spend over the range" isEmpty={!daily.length} empty="No expenses fall in this date range yet.">
            <TrendChart data={daily} color="slate" format="currency" />
          </ChartCard>
          <ChartCard title="Where the money went" isEmpty={!byCategory.length} empty="Nothing to break down in this range.">
            <RankBars data={byCategory} color="slate" format="currency" limit={10} />
          </ChartCard>
        </ChartGrid>

        <DataGrid
          title="Expense ledger"
          columns={columns}
          rows={rows}
          server={server}
          csvName="expenses"
          searchPlaceholder="Search description, supplier…"
          empty={loading ? 'Loading expenses…' : 'No expenses in this range. Change the dates, or log one.'}
          footNote="Rows marked Automatic belong to a purchase or a wastage entry — open that record to change them. CSV and Print cover every row in the range, not just this page."
          toolbar={
            <>
              <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className={SELECT}>
                <option value="all">All origins</option>
                <option value="manual">Manual only</option>
                <option value="purchase">From purchases</option>
                <option value="wastage">From wastage</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={SELECT}>
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
                {Object.entries(GENERATED_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </>
          }
          renderActions={(e) => {
            const meta = SOURCE_META[e.source_type];
            if (meta) {
              return (
                <Link
                  href={meta.href}
                  title={`Edit this on the ${meta.label.toLowerCase()} it came from`}
                  className="whitespace-nowrap rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Open {meta.label.toLowerCase()}
                </Link>
              );
            }
            return (
              <>
                <button type="button" title="Edit expense" aria-label="Edit expense" onClick={() => setModal({ expense: e, payroll: e.category === 'salaries' })} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" title="Delete expense" aria-label="Delete expense" onClick={() => handleDelete(e)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            );
          }}
        />
      </div>

      {modal && (
        <LogExpenseModal
          editingExpense={modal.expense || null}
          payrollMode={Boolean(modal.payroll)}
          onClose={() => setModal(null)}
          onSaved={fetchExpenses}
        />
      )}
    </AdminLayout>
  );
}

const SELECT = 'h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-700';
