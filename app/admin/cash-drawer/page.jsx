'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Lock, Unlock } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';
import { apiJson } from '@/lib/authed-fetch';
import { money } from '@/components/accounting/ledger-table';

export default function CashDrawerPage() {
  const { addToast } = useToast();
  const [data, setData] = useState({ drawers: [], sessions: [], open: null });
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState({ drawer_id: '', opening_amount: '' });
  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d = await apiJson('/api/admin/cash-drawer');
      setData(d);
      setOpenForm((f) => ({ ...f, drawer_id: f.drawer_id || String(d.drawers?.[0]?.id || '') }));
    } catch (error) { addToast(friendlyFromError(error, 'load_failed')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDrawer = async () => {
    setBusy(true);
    try {
      await apiJson('/api/admin/cash-drawer', { method: 'POST', body: JSON.stringify({ drawer_id: openForm.drawer_id || null, opening_amount: Number(openForm.opening_amount) || 0 }) });
      addToast(friendlyMessage('save_success', { description: 'Drawer opened.' }));
      setOpenForm((f) => ({ ...f, opening_amount: '' }));
      load();
    } catch (error) { addToast(friendlyFromError(error, 'save_failed')); }
    finally { setBusy(false); }
  };

  const closeDrawer = async () => {
    if (counted === '') { addToast(friendlyMessage('validation', { description: 'Enter the counted cash.' })); return; }
    setBusy(true);
    try {
      await apiJson('/api/admin/cash-drawer', { method: 'PUT', body: JSON.stringify({ session_id: data.open.id, counted_amount: Number(counted) }) });
      addToast(friendlyMessage('save_success', { description: 'Drawer closed and reconciled.' }));
      setCounted('');
      load();
    } catch (error) { addToast(friendlyFromError(error, 'save_failed')); }
    finally { setBusy(false); }
  };

  return (
    <AdminLayout>
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Cash Drawer</h1>
        <p className="mt-1 text-sm text-gray-500">Open with a float, close by counting. The difference posts to Cash Over / Short automatically.</p>
      </header>

      <div className="space-y-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
        {data.open ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-emerald-800">
              <Unlock className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{data.open.drawer_name} is open</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Opened by" value={data.open.opened_by_name || '—'} />
              <Stat label="Opening float" value={money(data.open.opening_amount)} />
              <Stat label="Opened at" value={new Date(data.open.opened_at).toLocaleString()} />
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-emerald-200 pt-4">
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Counted cash</span>
                <input type="number" min="0" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} className="h-11 w-48 rounded-lg border border-gray-300 px-3 text-sm" placeholder="0.00" />
              </label>
              <button disabled={busy} onClick={closeDrawer} className="inline-flex h-11 items-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                <Lock className="h-4 w-4" /> Close &amp; reconcile
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Open a drawer</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Drawer</span>
                <select value={openForm.drawer_id} onChange={(e) => setOpenForm((f) => ({ ...f, drawer_id: e.target.value }))} className="h-11 rounded-lg border border-gray-300 px-3 text-sm">
                  {data.drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Opening float</span>
                <input type="number" min="0" step="any" value={openForm.opening_amount} onChange={(e) => setOpenForm((f) => ({ ...f, opening_amount: e.target.value }))} className="h-11 w-48 rounded-lg border border-gray-300 px-3 text-sm" placeholder="0.00" />
              </label>
              <button disabled={busy || !data.drawers.length} onClick={openDrawer} className="inline-flex h-11 items-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                <Unlock className="h-4 w-4" /> Open drawer
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4"><h2 className="text-sm font-semibold text-gray-900">Session history</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Drawer</th>
                  <th className="px-4 py-3 font-semibold">Opened</th>
                  <th className="px-4 py-3 font-semibold">Closed</th>
                  <th className="px-4 py-3 text-right font-semibold">Opening</th>
                  <th className="px-4 py-3 text-right font-semibold">Expected</th>
                  <th className="px-4 py-3 text-right font-semibold">Counted</th>
                  <th className="px-4 py-3 text-right font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-900">{s.drawer_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{new Date(s.opened_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.closed_at ? new Date(s.closed_at).toLocaleString() : <span className="text-emerald-700">Open</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(s.opening_amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.expected_amount != null ? money(s.expected_amount) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.counted_amount != null ? money(s.counted_amount) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${Number(s.difference) < 0 ? 'text-rose-700' : Number(s.difference) > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                      {s.difference != null ? money(s.difference) : '—'}
                    </td>
                  </tr>
                ))}
                {!loading && data.sessions.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No sessions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value }) {
  return <div><p className="text-xs font-medium text-emerald-700/70">{label}</p><p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{value}</p></div>;
}
