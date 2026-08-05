'use client';

/**
 * Find a previous (paid) bill and reopen it to add more items — the
 * "please bring one more Coke" flow. Works for Admin and Cashier; the caller
 * passes redirectBase so the reactivated order opens in the right screen.
 *
 *   <ReopenBillModal open onClose={...} redirectBase="/cashier/bill" />
 *
 * The server creates an audited supplemental order. The paid bill, payment,
 * journal, served items, and stock history remain unchanged.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, RotateCcw, Loader2 } from 'lucide-react';
import { authedRequest } from '@/lib/authed-fetch';
import { formatCurrency } from '@/lib/currency';
import { getNepaliDateTime } from '@/lib/time-utils';

export default function ReopenBillModal({ open, onClose, redirectBase = '/cashier/bill', buildHref, onReopened }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ(''); setBills([]); setSelected(null); setReason(''); setError('');
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Debounced search of reopenable (paid) bills.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authedRequest(`/api/restaurant/bills/reopen?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        setBills(res.ok ? data.bills || [] : []);
      } catch {
        setBills([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  const doReopen = async () => {
    if (!selected) return;
    if (!reason.trim()) { setError('Please enter why this bill is being reopened.'); return; }
    setBusy(true); setError('');
    try {
      const res = await authedRequest('/api/restaurant/bills/reopen', {
        method: 'POST',
        body: JSON.stringify({ bill_id: selected.id, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reopen this bill.');
      onReopened?.(data);
      onClose?.();
      router.push(buildHref ? buildHref(data.order_id) : `${redirectBase}/${data.order_id}`);
    } catch (e) {
      setError(e.message || 'Could not reopen this bill.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <RotateCcw className="h-5 w-5 text-amber-600" /> Reopen a bill
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-sm text-gray-600">
            Search by bill number, table, order, or customer. A linked empty order is created for new
            items only. The original paid invoice and accounting history stay unchanged.
          </p>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setSelected(null); }}
              placeholder="Bill no., table, customer…"
              className="w-full rounded-lg border-2 border-gray-200 py-2.5 pl-9 pr-3 text-gray-900 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="mb-3 max-h-56 overflow-y-auto rounded-lg border border-gray-100">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : bills.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No paid bills found.</p>
            ) : (
              bills.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className={`flex w-full items-center justify-between border-b border-gray-50 px-4 py-3 text-left last:border-0 transition-colors ${
                    selected?.id === b.id ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{b.bill_number}</p>
                    <p className="truncate text-xs text-gray-500">
                      {b.table_number ? `Table ${b.table_number} · ` : ''}
                      {b.customer_name || 'Walk-in'} · {getNepaliDateTime(b.created_at)}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 font-bold text-gray-900">{formatCurrency(b.grand_total)}</span>
                </button>
              ))
            )}
          </div>

          {selected && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-semibold text-gray-800">
                Reason for reopening <span className="text-red-500">*</span>
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer ordered one more Coke"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border-2 border-gray-200 py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={doReopen}
              disabled={!selected || busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Create supplement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
