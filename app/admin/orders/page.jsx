'use client';

/**
 * Order history.
 *
 * The list is paginated, filtered and sorted on the server — the page used to
 * pull every order ever placed and narrow it in the browser, which is fine at
 * 200 orders and hopeless at 36,000. The summary tiles read the API's own
 * totals for the whole filtered set rather than adding up the current page.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import { Eye, Filter, Printer } from 'lucide-react';
import DataGrid, { StatusBadge } from '@/components/admin/data-grid';
import useServerList from '@/lib/use-server-list';
import { formatCurrency } from '@/lib/currency';
import { useToast } from '@/components/ui/toast';
import { friendlyFromError } from '@/lib/friendly-message';

const STATUS_TONE = {
  pending: 'amber',
  preparing: 'blue',
  ready: 'green',
  completed: 'gray',
  cancelled: 'red',
};

const STATUSES = ['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'];

export default function AdminOrders() {
  const router = useRouter();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');

  const filters = useMemo(() => ({ status: statusFilter }), [statusFilter]);

  const { rows, extra, server, loading } = useServerList({
    url: '/api/admin/orders',
    key: 'orders',
    filters,
    initialSort: { key: 'created_at', dir: 'desc' },
    onError: (error) => addToast(friendlyFromError(error, 'load_failed')),
  });

  const summary = extra.summary;

  const columns = useMemo(
    () => [
      { key: 'order_number', label: 'Order #', className: 'text-gray-900 font-medium' },
      {
        key: 'created_at',
        label: 'Date & Time',
        render: (o) => new Date(o.created_at).toLocaleString(),
      },
      { key: 'customer_name', label: 'Customer', render: (o) => o.customer_name || 'Walk-in' },
      { key: 'table_number', label: 'Table', render: (o) => o.table_number || '—' },
      {
        key: 'order_type',
        label: 'Type',
        render: (o) => <span className="capitalize">{(o.order_type || 'dine-in').replace(/_/g, ' ')}</span>,
      },
      {
        key: 'total',
        label: 'Total',
        align: 'right',
        numeric: true,
        className: 'text-gray-900 font-medium',
        render: (o) => formatCurrency(o.total || 0),
      },
      {
        key: 'status',
        label: 'Status',
        render: (o) => <StatusBadge tone={STATUS_TONE[o.status] || 'gray'}>{o.status || 'unknown'}</StatusBadge>,
      },
    ],
    []
  );

  const tiles = [
    { label: 'Total Orders', value: summary ? summary.orders.toLocaleString() : '—' },
    { label: 'Total Revenue', value: summary ? formatCurrency(summary.revenue) : '—' },
    { label: 'Average Order Value', value: summary ? formatCurrency(summary.average) : '—' },
    { label: 'Completed Orders', value: summary ? summary.completed.toLocaleString() : '—' },
  ];

  return (
    <AdminLayout>
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-1 text-sm">Every order the restaurant has taken.</p>
      </header>

      <div className="space-y-5 bg-gray-50 p-4 sm:p-6 lg:p-8">
        {/* Totals describe the whole filtered set, not the page on screen. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <p className="text-xs font-medium text-gray-500 sm:text-sm">{t.label}</p>
              <h3 className="mt-2 truncate text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{t.value}</h3>
            </div>
          ))}
        </div>

        <DataGrid
          title="Order history"
          columns={columns}
          rows={rows}
          server={server}
          csvName="orders"
          searchPlaceholder="Search order #, customer, table, bill…"
          empty="No orders match these filters yet."
          onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
          toolbar={
            <label className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 capitalize"
                aria-label="Filter by status"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s === 'all' ? 'All statuses' : s}
                  </option>
                ))}
              </select>
            </label>
          }
          renderActions={(o) => (
            <>
              <button
                type="button"
                onClick={() => router.push(`/admin/orders/${o.id}`)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                title="Print"
              >
                <Printer className="h-4 w-4" />
              </button>
            </>
          )}
          footNote={loading ? 'Loading…' : 'CSV and Print export every order matching the filters above, not just this page.'}
        />
      </div>
    </AdminLayout>
  );
}
