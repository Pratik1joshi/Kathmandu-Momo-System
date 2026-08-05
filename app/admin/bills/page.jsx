'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search, X } from 'lucide-react';
import { apiJson } from '@/lib/authed-fetch';
import { formatCurrency } from '@/lib/currency';
import ReopenBillModal from '@/components/billing/reopen-bill-modal';

const TABS = [
  ['active', 'Active'], ['pending', 'Pending payment'], ['completed', 'Completed'],
  ['cancelled', 'Cancelled / void'], ['all', 'All'],
];

function Status({ value }) {
  const tone = value === 'paid' || value === 'completed'
    ? 'bg-emerald-50 text-emerald-700'
    : ['cancelled', 'void', 'voided', 'refunded'].includes(value)
      ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800';
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{String(value || 'unknown').replaceAll('_', ' ')}</span>;
}

export default function BillsPage() {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ bills: [], counts: {}, pagination: { page: 1, pages: 1, total: 0 } });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ tab, page: String(page), page_size: '25' });
      if (query) params.set('q', query);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      setData(await apiJson(`/api/admin/bills?${params}`));
    } catch (err) {
      setError(err.error || 'Could not load bills.');
    } finally { setLoading(false); }
  }, [tab, page, query, from, to]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(id) {
    try { setDetail((await apiJson(`/api/admin/bills?id=${id}`)).bill); }
    catch (err) { setError(err.error || 'Could not load bill details.'); }
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-950">Bills</h1><p className="mt-1 text-sm text-gray-600">Search every channel, inspect payment history, and create controlled supplements.</p></div>
          <button type="button" onClick={() => setReopenOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white active:scale-[0.97]">
            <RefreshCw className="h-4 w-4" /> Create supplement
          </button>
        </div>

        <div className="overflow-x-auto border-b border-gray-200">
          <div className="flex min-w-max gap-1">
            {TABS.map(([key, label]) => <button key={key} onClick={() => { setTab(key); setPage(1); }} className={`px-3 py-2.5 text-sm font-semibold ${tab === key ? 'border-b-2 border-blue-700 text-blue-800' : 'text-gray-600 hover:text-gray-950'}`}>{label} <span className="ml-1 tabular-nums text-xs">{data.counts?.[key] ?? 0}</span></button>)}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-[minmax(240px,1fr)_170px_170px_auto]">
          <label className="relative"><span className="sr-only">Search bills</span><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill, order, customer, phone, table" className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
          <label><span className="sr-only">From date</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label>
          <label><span className="sr-only">To date</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label>
          <button className="h-10 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white active:scale-[0.97]">Search</button>
        </form>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button onClick={load} className="ml-2 font-semibold underline">Retry</button></div>}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="divide-y divide-gray-100 md:hidden">
            {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-4"><div className="h-24 animate-pulse rounded bg-gray-100" /></div>) : data.bills.length === 0 ? <div className="px-4 py-16 text-center text-sm text-gray-500">No bills match these filters.</div> : data.bills.map((bill) => {
              const balance = Math.max(Number(bill.grand_total) - Number(bill.paid_amount), 0);
              return <article key={bill.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><button onClick={() => openDetail(bill.id)} className="break-all text-left font-semibold text-blue-800 hover:underline">{bill.bill_number}</button><p className="mt-0.5 text-xs text-gray-500">{bill.order_number}</p></div><Status value={bill.bill_status} /></div><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div><span className="block text-xs text-gray-500">Customer</span><span className="font-medium text-gray-900">{bill.customer_name || 'Walk-in'}</span></div><div><span className="block text-xs text-gray-500">Channel</span><span className="capitalize text-gray-900">{String(bill.order_type || '').replaceAll('_', ' ')}</span></div><div><span className="block text-xs text-gray-500">Table</span><span className="text-gray-900">{bill.floor_name ? `${bill.floor_name} / ` : ''}{bill.table_number || 'No table'}</span></div><div><span className="block text-xs text-gray-500">KOT</span><span className="text-gray-900">{bill.kot_count ? `${bill.open_kot_count}/${bill.kot_count} open` : 'No KOT'}</span></div></div><div className="flex items-end justify-between gap-3 border-t border-gray-100 pt-3"><div><span className="block text-xs text-gray-500">Paid / balance</span><span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(bill.paid_amount)}</span><span className={`ml-2 text-xs tabular-nums ${balance ? 'text-amber-700' : 'text-gray-400'}`}>{formatCurrency(balance)}</span></div><button onClick={() => openDetail(bill.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold text-gray-800 active:scale-[0.97]"><Eye className="h-4 w-4" />View</button></div></article>;
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Bill / order</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Customer / table</th><th className="px-4 py-3">People</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid / balance</th><th className="px-4 py-3">States</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan="9" className="px-4 py-4"><div className="h-5 animate-pulse rounded bg-gray-100" /></td></tr>) : data.bills.length === 0 ? <tr><td colSpan="9" className="px-4 py-16 text-center text-gray-500">No bills match these filters.</td></tr> : data.bills.map((bill) => {
                  const balance = Math.max(Number(bill.grand_total) - Number(bill.paid_amount), 0);
                  return <tr key={bill.id} className="align-top hover:bg-gray-50/70"><td className="px-4 py-3"><button onClick={() => openDetail(bill.id)} className="font-semibold text-blue-800 hover:underline">{bill.bill_number}</button><div className="mt-1 text-xs text-gray-500">{bill.order_number}{bill.reopen_count ? ` | ${bill.reopen_count} supplement(s)` : ''}</div></td><td className="px-4 py-3 capitalize text-gray-700">{String(bill.order_type || '').replaceAll('_', ' ')}</td><td className="px-4 py-3"><div className="font-medium text-gray-900">{bill.customer_name || 'Walk-in'}</div><div className="text-xs text-gray-500">{bill.floor_name ? `${bill.floor_name} / ` : ''}{bill.table_number ? `Table ${bill.table_number}` : bill.customer_phone || 'No table'}</div></td><td className="px-4 py-3 text-xs text-gray-600"><div>Waiter: {bill.waiter_name || 'Not assigned'}</div><div>Cashier: {bill.cashier_name || 'Not recorded'}</div></td><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(bill.grand_total)}</td><td className="px-4 py-3 text-right tabular-nums"><div className="text-emerald-700">{formatCurrency(bill.paid_amount)}</div><div className={balance > 0 ? 'text-amber-700' : 'text-gray-400'}>{formatCurrency(balance)}</div></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Status value={bill.bill_status} /><Status value={bill.order_status} /></div><div className="mt-1 text-xs text-gray-500">{bill.kot_count ? `${bill.open_kot_count}/${bill.kot_count} open KOT` : 'No KOT'}</div></td><td className="px-4 py-3 text-xs text-gray-600">{new Date(bill.updated_at || bill.created_at).toLocaleString()}</td><td className="px-4 py-3"><button onClick={() => openDetail(bill.id)} aria-label={`View ${bill.bill_number}`} className="rounded-md p-2 text-gray-600 hover:bg-gray-100 active:scale-[0.97]"><Eye className="h-4 w-4" /></button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600"><span>{data.pagination.total || 0} result(s)</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="tabular-nums">{page} / {data.pagination.pages || 1}</span><button disabled={page >= (data.pagination.pages || 1)} onClick={() => setPage((p) => p + 1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
        </div>
      </div>

      {detail && <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={() => setDetail(null)}><aside role="dialog" aria-modal="true" aria-label={`Bill ${detail.bill_number}`} onMouseDown={(e) => e.stopPropagation()} className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4"><div><h2 className="text-lg font-bold">{detail.bill_number}</h2><p className="text-xs text-gray-500">{detail.order_number}</p></div><button onClick={() => setDetail(null)} className="rounded-md p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div><div className="space-y-6 p-5"><section className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm"><div><span className="text-gray-500">Channel</span><p className="font-semibold capitalize">{String(detail.order_type).replaceAll('_', ' ')}</p></div><div><span className="text-gray-500">Customer</span><p className="font-semibold">{detail.customer_name || 'Walk-in'}</p></div><div><span className="text-gray-500">Location</span><p className="font-semibold">{detail.floor_name || ''} {detail.table_number ? `Table ${detail.table_number}` : 'No table'}</p></div><div><span className="text-gray-500">Status</span><p className="mt-1"><Status value={detail.status} /></p></div></section><section><h3 className="mb-2 font-bold">Items</h3><div className="divide-y rounded-lg border">{detail.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm"><div>{item.quantity} x {item.item_name}<div className="text-xs text-gray-500">{item.special_instructions}</div></div><span className="tabular-nums">{formatCurrency(item.subtotal)}</span></div>)}</div></section><section className="grid gap-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Total</span><strong>{formatCurrency(detail.grand_total)}</strong></div><div className="flex justify-between text-emerald-700"><span>Paid</span><strong>{formatCurrency(detail.paid_amount)}</strong></div><div className="flex justify-between text-amber-700"><span>Balance</span><strong>{formatCurrency(detail.balance_due)}</strong></div></section><section><h3 className="mb-2 font-bold">Payments</h3>{detail.payments.length ? <div className="space-y-2">{detail.payments.map((p) => <div key={p.id} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span className="capitalize">{p.payment_method}{p.reference_number ? ` | ${p.reference_number}` : ''}</span><strong>{formatCurrency(p.amount)}</strong></div>)}</div> : <p className="text-sm text-gray-500">No payment recorded.</p>}</section><section><h3 className="mb-2 font-bold">Supplements and activity</h3>{detail.revisions.length === 0 && detail.corrections.length === 0 ? <p className="text-sm text-gray-500">No revisions or corrections.</p> : <div className="space-y-2 text-sm">{detail.revisions.map((r) => <div key={r.order_id} className="rounded-lg border p-3"><Link className="font-semibold text-blue-800 hover:underline" href={`/admin/order/${r.order_id}`}>{r.order_number}</Link><p className="text-gray-500">{r.bill_number || 'Not billed'} | {r.order_status}</p></div>)}{detail.corrections.map((c) => <div key={c.id} className="rounded-lg border p-3"><strong className="capitalize">{c.type}</strong><p className="text-gray-600">{c.reason || 'No reason recorded'}</p></div>)}</div>}</section></div></aside></div>}
      <ReopenBillModal open={reopenOpen} onClose={() => setReopenOpen(false)} buildHref={(id) => `/admin/order/${id}`} onReopened={load} />
    </div>
  );
}
