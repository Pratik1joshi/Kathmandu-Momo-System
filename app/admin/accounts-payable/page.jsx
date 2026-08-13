'use client';

import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';
import { apiJson } from '@/lib/authed-fetch';
import LedgerTable, { money } from '@/components/accounting/ledger-table';
import { adminInputClass } from '@/components/ui/admin-form';

const BUCKETS = ['0-30', '31-60', '61-90', '90+'];

export default function AccountsPayablePage() {
  const { addToast } = useToast();
  const [data, setData] = useState({ payables: [], ageing: [], liabilities: [], banks: [] });
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState(null); // { supplier, lines }
  const [payFor, setPayFor] = useState(null); // supplier row
  const [form, setForm] = useState({ amount: '', method: 'cash', bank_account_id: '', note: '' });
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(newKey());

  const load = async () => {
    try { setData(await apiJson('/api/admin/accounts-payable')); }
    catch (error) { addToast(friendlyFromError(error, 'load_failed')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openStatement = async (s) => {
    try {
      const d = await apiJson(`/api/admin/accounts-payable?supplier_id=${s.id}`);
      setStatement({ supplier: s, lines: d.statement || [] });
    } catch (error) { addToast(friendlyFromError(error, 'load_failed')); }
  };

  const openPay = (s) => {
    setPayFor(s);
    setForm({ amount: String(s.outstanding), method: 'cash', bank_account_id: String(data.banks?.[0]?.id || ''), note: '' });
  };

  const pay = async () => {
    if (!(Number(form.amount) > 0)) { addToast(friendlyMessage('validation', { description: 'Enter an amount.' })); return; }
    setBusy(true);
    try {
      await apiJson('/api/admin/accounts-payable', { method: 'POST', body: JSON.stringify({
        supplier_id: payFor.id, amount: Number(form.amount), method: form.method,
        bank_account_id: form.method === 'cash' ? null : form.bank_account_id, note: form.note, external_ref: keyRef.current,
      }) });
      addToast(friendlyMessage('save_success', { description: 'Supplier payment posted.' }));
      keyRef.current = newKey();
      setPayFor(null);
      load();
    } catch (error) { addToast(friendlyFromError(error, 'save_failed')); }
    finally { setBusy(false); }
  };

  const totalAP = data.payables.reduce((s, p) => s + Number(p.outstanding), 0);

  return (
    <AdminLayout>
      <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Accounts Payable</h1>
        <p className="mt-1 text-sm text-gray-500">What you owe suppliers — outstanding balances, ageing, and payments. All from the ledger.</p>
      </header>

      <div className="space-y-6 bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-gray-900 bg-gray-900 px-5 py-4 text-white">
          <div className="flex items-center justify-between"><span className="text-sm font-medium">Total outstanding to suppliers</span><span className="text-xl font-bold tabular-nums">{money(totalAP)}</span></div>
        </div>

        <Panel title="Ageing">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-5 py-3 font-semibold">Supplier</th>{BUCKETS.map((b) => <th key={b} className="px-5 py-3 text-right font-semibold">{b} days</th>)}<th className="px-5 py-3 text-right font-semibold">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.ageing.map((r) => (
                  <tr key={r.supplier_id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-gray-900">{r.name}</td>
                    {BUCKETS.map((b) => <td key={b} className={`px-5 py-2.5 text-right tabular-nums ${b === '90+' && r[b] > 0 ? 'text-rose-700 font-medium' : 'text-gray-700'}`}>{r[b] ? money(r[b]) : '—'}</td>)}
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-gray-900">{money(r.total)}</td>
                  </tr>
                ))}
                {!loading && data.ageing.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Nothing outstanding — all suppliers settled.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Supplier balances">
          <div className="divide-y divide-gray-100">
            {data.payables.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <button onClick={() => openStatement(s)} className="flex-1 text-left text-sm font-medium text-gray-900 hover:underline">{s.name}</button>
                <span className="tabular-nums text-sm text-gray-900">{money(s.outstanding)}</span>
                <button onClick={() => openPay(s)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">Pay</button>
              </div>
            ))}
            {!loading && data.payables.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-500">No outstanding supplier balances.</p>}
          </div>
        </Panel>

        <Panel title="Liability Ledger">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {data.liabilities.map((l) => (
                <tr key={l.code}><td className="px-5 py-2.5 text-gray-500">{l.code}</td><td className="px-5 py-2.5 text-gray-900">{l.name}</td><td className="px-5 py-2.5 text-right tabular-nums text-gray-900">{money(l.balance)}</td></tr>
              ))}
              {data.liabilities.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-500">No liabilities.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>

      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white p-6 sm:p-8 max-h-[94dvh] overflow-y-auto">
            <h3 className="mb-1 text-lg font-bold text-gray-900">Pay {payFor.name}</h3>
            <p className="mb-4 text-sm text-gray-500">Outstanding {money(payFor.outstanding)}</p>
            <div className="space-y-3">
              <Field label="Amount"><input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={INPUT} /></Field>
              <Field label="Method">
                <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className={INPUT}>
                  <option value="cash">Cash</option><option value="bank">Bank</option><option value="cheque">Cheque</option>
                </select>
              </Field>
              {form.method !== 'cash' && (
                <Field label="Bank account">
                  <select value={form.bank_account_id} onChange={(e) => setForm((f) => ({ ...f, bank_account_id: e.target.value }))} className={INPUT}>
                    {data.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Note"><input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={INPUT} placeholder="optional" /></Field>
            </div>
            <div className="mt-6 flex gap-3">
              <button disabled={busy} onClick={pay} className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{busy ? 'Saving…' : 'Post payment'}</button>
              <button onClick={() => setPayFor(null)} className="flex-1 rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {statement && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setStatement(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
            <header className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Supplier statement</p><h2 className="text-lg font-semibold text-gray-900">{statement.supplier.name}</h2></div>
              <button onClick={() => setStatement(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </header>
            <div className="p-5">
              <LedgerTable lines={statement.lines} debitNormal={false} empty="No AP movements for this supplier." />
            </div>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}

function Panel({ title, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4"><h2 className="text-sm font-semibold text-gray-900">{title}</h2></div>
      {children}
    </section>
  );
}
function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>{children}</label>;
}
const INPUT = adminInputClass;
function newKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random()}`;
}
