'use client';

/**
 * Shared live floor board for Admin and Cashier. Shows occupied + free tables
 * and routes into the real dine-in POS (/waiter/new-order): occupied tables
 * open their order, free tables start one. Transfer / merge are inline.
 * No order-build logic is duplicated here — it delegates to the existing screen.
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRightLeft, Plus, RefreshCw } from 'lucide-react';
import { authedRequest } from '@/lib/authed-fetch';
import { formatCurrency } from '@/lib/currency';
import TableActionsModal from '@/components/billing/table-actions-modal';

/**
 * variant:
 *   'order' — order-taking (waiter/admin dine-in start): occupied opens the order
 *             screen, free tables start a new dine-in order.
 *   'bill'  — billing (cashier/admin billing): occupied opens the BILL screen to
 *             take payment; free tables are hidden (you don't bill an empty table).
 */
export default function TableFloorBoard({
  title = 'Dine-in floor',
  subtitle = 'Open an occupied table, or start a new dine-in order.',
  variant = 'order',
  basePath = '/waiter',
}) {
  const router = useRouter();
  const billing = variant === 'bill';
  const [free, setFree] = useState([]);
  const [occupied, setOccupied] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionsTable, setActionsTable] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, o, av] = await Promise.all([
        authedRequest('/api/restaurant/tables').then((r) => r.json()).catch(() => ({})),
        authedRequest('/api/restaurant/tables?type=occupied').then((r) => r.json()).catch(() => ({})),
        authedRequest('/api/restaurant/tables?type=available').then((r) => r.json()).catch(() => ({})),
      ]);
      setAll(a.tables || []);
      setOccupied(o.tables || []);
      setFree(av.tables || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openOrder = (t) => {
    const orderId = t.current_order_id || t.order_id;
    if (!orderId) return;
    // Everything stays inside the current role's module (basePath).
    router.push(billing ? `${basePath}/bill/${orderId}` : `${basePath}/order/${orderId}`);
  };
  const startOrder = (t) => router.push(`${basePath}/new-order?table=${t.table_id || t.id}`);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-500">Loading floor…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">In service ({occupied.length})</h3>
            {occupied.length === 0 ? (
              <p className="text-sm text-gray-400">No occupied tables.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {occupied.map((t) => (
                  <div key={t.table_id || t.id} className="rounded-xl border-2 border-rose-200 bg-rose-50 p-3">
                    <div className="flex items-start justify-between">
                      <span className="text-lg font-bold text-gray-900">{t.table_number}</span>
                      <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-800">Occupied</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                      <Users className="h-3 w-3" /> {t.capacity} seats
                      {t.total_amount != null && <span className="ml-auto font-semibold text-gray-900">{formatCurrency(t.total_amount)}</span>}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => openOrder(t)} className="flex-1 rounded-lg bg-gray-900 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">
                        {billing ? 'Bill / Pay' : 'Open order'}
                      </button>
                      <button onClick={() => setActionsTable(t)} title="Move / Merge" className="rounded-lg bg-amber-200 px-2 py-1.5 text-amber-800 hover:bg-amber-300">
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!billing && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Available ({free.length})</h3>
            {free.length === 0 ? (
              <p className="text-sm text-gray-400">No free tables.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {free.map((t) => (
                  <button
                    key={t.table_id || t.id}
                    onClick={() => startOrder(t)}
                    className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-left hover:border-emerald-400"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-lg font-bold text-gray-900">{t.table_number}</span>
                      <Plus className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-600"><Users className="h-3 w-3" /> {t.capacity} seats</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">Start dine-in</p>
                  </button>
                ))}
              </div>
            )}
          </section>
          )}
        </div>
      )}

      {actionsTable && (
        <TableActionsModal
          table={{ ...actionsTable, id: actionsTable.table_id || actionsTable.id }}
          tables={all.map((t) => ({ ...t, id: t.table_id || t.id }))}
          onClose={() => setActionsTable(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
