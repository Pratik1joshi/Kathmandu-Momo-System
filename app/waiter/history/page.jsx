'use client';

/**
 * Waiter order history — find any order (today / active / completed / all),
 * search by table, bill no., order no. or customer, and act: open an active
 * order to keep serving, or reopen a closed bill to add "one more" and re-bill.
 * Reuses the shared reopen engine.
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, RotateCcw, ExternalLink, Loader2 } from 'lucide-react';
import { authedRequest } from '@/lib/authed-fetch';
import { formatCurrency } from '@/lib/currency';
import { getNepaliDateTime } from '@/lib/time-utils';
import ReopenBillModal from '@/components/billing/reopen-bill-modal';
import { usePermissions } from '@/lib/use-permissions';

const SCOPES = [
  { key: 'today', label: 'Today' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All (30d)' },
];

const STATUS_TONE = {
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
  preparing: 'bg-orange-100 text-orange-800',
  pending: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  dining: 'bg-blue-100 text-blue-800',
  served: 'bg-blue-100 text-blue-800',
  awaiting_payment: 'bg-amber-100 text-amber-900',
};

export default function WaiterHistoryPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canReopen = can('reopen_bills');
  const [scope, setScope] = useState('today');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reopenOpen, setReopenOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, q, ...(mine ? { mine: '1' } : {}) });
      const res = await authedRequest(`/api/restaurant/orders/history?${params}`);
      const data = await res.json().catch(() => ({}));
      setRows(res.ok ? data.orders || [] : []);
    } finally {
      setLoading(false);
    }
  }, [scope, q, mine]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Reopen a specific paid order from its row (reason required by the API).
  const doReopen = async (r) => {
    const reason = window.prompt(`Reopen bill ${r.bill_number || ''}? Enter a reason:`);
    if (reason == null || !reason.trim()) return;
    const res = await authedRequest('/api/restaurant/bills/reopen', {
      method: 'POST',
      body: JSON.stringify({ bill_id: r.bill_id, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/waiter/order/${data.order_id}`);
    else alert(data.error || 'Could not reopen this bill.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/waiter')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" /> <span className="font-semibold">Floor</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Order History</h1>
          </div>
          {canReopen && (
            <button
              onClick={() => setReopenOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              <RotateCcw className="h-4 w-4" /> Reopen a bill
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Table, bill no., order no., customer…"
              className="w-full rounded-lg border-2 border-gray-200 py-2.5 pl-9 pr-3 text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 rounded" />
            Only mine
          </label>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
          {SCOPES.map((sc) => (
            <button
              key={sc.key}
              onClick={() => setScope(sc.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                scope === sc.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No orders found.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.order_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-900">
                        {r.bill_number || r.order_number || `#${r.order_id}`}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status] || 'bg-gray-100 text-gray-700'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {r.table_number ? `Table ${r.table_number} · ` : 'Takeaway · '}
                      {r.customer_name || 'Walk-in'}
                      {r.waiter_name ? ` · ${r.waiter_name}` : ''} · {getNepaliDateTime(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">{formatCurrency(r.amount)}</span>
                    {r.is_active ? (
                      <button
                        onClick={() => router.push(`/waiter/order/${r.order_id}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </button>
                    ) : r.can_reopen && canReopen ? (
                      <button
                        onClick={() => doReopen(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                        title="Reopen this bill to add items"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ReopenBillModal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        buildHref={(id) => `/waiter/order/${id}`}
      />
    </div>
  );
}
