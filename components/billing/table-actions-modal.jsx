'use client';

/**
 * Floor actions for an occupied table: transfer the order to a free table, or
 * merge this table into another occupied table (one bill). Table-id based, so
 * callers don't need the order id. Reusable across Admin, Cashier and Waiter.
 *
 *   <TableActionsModal table={t} tables={allTables} onClose={...} onDone={...} />
 */
import { useMemo, useState } from 'react';
import { X, ArrowRightLeft, Combine, Loader2 } from 'lucide-react';
import { authedRequest } from '@/lib/authed-fetch';
import { usePermissions } from '@/lib/use-permissions';

const isOccupied = (t) => t.status === 'occupied' || t.current_order_id;

export default function TableActionsModal({ table, tables = [], onClose, onDone }) {
  const { can } = usePermissions();
  const canTransfer = can('transfer_tables');
  const canMerge = can('merge_tables');
  const [mode, setMode] = useState(canTransfer ? 'transfer' : 'merge'); // 'transfer' | 'merge'
  const [dest, setDest] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const freeTables = useMemo(
    () => tables.filter((t) => t.id !== table.id && !isOccupied(t) && Number(t.is_active) !== 0),
    [tables, table]
  );
  const occupiedTables = useMemo(
    () => tables.filter((t) => t.id !== table.id && isOccupied(t)),
    [tables, table]
  );

  const options = mode === 'transfer' ? freeTables : occupiedTables;

  const submit = async () => {
    if (!dest) { setError('Choose a destination table.'); return; }
    setBusy(true); setError('');
    try {
      const url = mode === 'transfer' ? '/api/restaurant/tables/transfer' : '/api/restaurant/tables/merge';
      const body =
        mode === 'transfer'
          ? { from_table_id: table.id, to_table_id: Number(dest), reason: reason.trim() }
          : { source_table_id: table.id, target_table_id: Number(dest), reason: reason.trim() };
      const res = await authedRequest(url, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That action could not be completed.');
      onDone?.(data);
      onClose?.();
    } catch (e) {
      setError(e.message || 'That action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Table {table.table_number}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {(canTransfer || canMerge) ? (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {canTransfer && (
                <button
                  onClick={() => { setMode('transfer'); setDest(''); setError(''); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors ${
                    mode === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  } ${!canMerge ? 'col-span-2' : ''}`}
                >
                  <ArrowRightLeft className="h-4 w-4" /> Transfer
                </button>
              )}
              {canMerge && (
                <button
                  onClick={() => { setMode('merge'); setDest(''); setError(''); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors ${
                    mode === 'merge' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  } ${!canTransfer ? 'col-span-2' : ''}`}
                >
                  <Combine className="h-4 w-4" /> Merge
                </button>
              )}
            </div>
          ) : (
            <p className="mb-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">You don’t have permission to transfer or merge tables.</p>
          )}

          <p className="mb-3 text-sm text-gray-600">
            {mode === 'transfer'
              ? 'Move this table’s order to a free table. The current table is released.'
              : 'Merge this table into another occupied table. This table’s items and KOTs move onto one bill, and this table is freed.'}
          </p>

          <label className="mb-1 block text-sm font-semibold text-gray-800">
            {mode === 'transfer' ? 'Move to' : 'Merge into'}
          </label>
          <select
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            className="mb-3 w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select a table…</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.table_number}{t.floor ? ` · ${t.floor}` : ''}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <p className="mb-3 text-xs text-gray-500">
              {mode === 'transfer' ? 'No free tables available.' : 'No other occupied tables to merge with.'}
            </p>
          )}

          <label className="mb-1 block text-sm font-semibold text-gray-800">Reason <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === 'transfer' ? 'e.g. moved to a bigger table' : 'e.g. friends joined'}
            className="mb-4 w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none"
          />

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border-2 border-gray-200 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !dest}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-white disabled:opacity-50 ${
                mode === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'transfer' ? <ArrowRightLeft className="h-4 w-4" /> : <Combine className="h-4 w-4" />}
              {mode === 'transfer' ? 'Transfer' : 'Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
