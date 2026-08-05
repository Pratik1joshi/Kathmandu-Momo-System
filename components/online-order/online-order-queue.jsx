'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, ExternalLink, MessageCircle, RefreshCw, XCircle } from 'lucide-react';

const tabs = ['PENDING', 'ACCEPTED', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ALL'];
const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-NP')}`;
const tone = { PENDING: 'bg-amber-100 text-amber-800', ACCEPTED: 'bg-blue-100 text-blue-800', READY: 'bg-emerald-100 text-emerald-800', COMPLETED: 'bg-slate-100 text-slate-700', CANCELLED: 'bg-red-100 text-red-700', REFUNDED: 'bg-violet-100 text-violet-700' };
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('pos_token') || ''}` });

export default function OnlineOrderQueue({ basePath = '/admin' }) {
  const [status, setStatus] = useState('PENDING');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/online-orders?status=${status}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load requests.');
      setOrders(data.orders || []); setCounts(data.counts || {});
      if (selected) {
        const current = (data.orders || []).find((row) => row.id === selected.id);
        if (current) setSelected((old) => ({ ...old, ...current }));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [selected, status]);

  useEffect(() => { load(); const timer = setInterval(load, 20000); return () => clearInterval(timer); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(id) {
    setError('');
    const response = await fetch(`/api/admin/online-orders/${id}`, { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not load this request.');
    setSelected(data.order); setReason('');
  }

  async function action(name) {
    setBusy(name); setError('');
    try {
      const response = await fetch(`/api/admin/online-orders/${selected.id}`, {
        method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: name, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The request changed before this action completed.');
      setSelected(data.order); setReason(''); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Operations</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Website & WhatsApp orders</h1><p className="mt-1 text-sm text-slate-600">Requests remain outside Kitchen and accounting until staff accepts them.</p></div><button onClick={load} className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">{tabs.map((tab) => <button key={tab} onClick={() => { setStatus(tab); setSelected(null); }} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${status === tab ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{tab[0] + tab.slice(1).toLowerCase()}{tab === 'PENDING' && Number(counts.pending) > 0 ? ` (${counts.pending})` : ''}</button>)}</div>
      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading && orders.length === 0 ? <div className="space-y-3 p-4">{[1,2,3].map((n) => <div key={n} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div> : orders.length === 0 ? <div className="py-20 text-center"><Clock3 className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No {status.toLowerCase()} requests</p><p className="mt-1 text-sm text-slate-500">New requests will appear here automatically.</p></div> : <div className="divide-y divide-slate-100">{orders.map((order) => <button key={order.id} onClick={() => openDetail(order.id)} className={`grid w-full gap-2 p-4 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[1fr_auto] ${selected?.id === order.id ? 'bg-slate-50 ring-1 ring-inset ring-slate-300' : ''}`}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-slate-900">{order.reference}</strong><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${order.source === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'}`}>{order.source}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone[order.status]}`}>{order.status}</span></div><p className="mt-1 text-sm text-slate-700">{order.customer_name} · {order.customer_phone}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString()} · {order.item_count} lines · {order.fulfillment_method}</p></div><div className="sm:text-right"><strong className="text-slate-900">{money(order.total_amount)}</strong><p className="mt-1 text-xs font-semibold text-slate-500">{order.payment_status}</p></div></button>)}</div>}
        </section>
        <aside className="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-5 lg:self-start">{!selected ? <div className="py-16 text-center text-sm text-slate-500">Select a request to review customer, item, audit, and action details.</div> : <>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{selected.source} request</p><h2 className="mt-1 text-xl font-bold text-slate-900">{selected.reference}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone[selected.status]}`}>{selected.status}</span></div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">{selected.customer_name}</p><p className="text-slate-600">{selected.customer_phone} · {selected.fulfillment_method}</p>{selected.notes && <p className="mt-2 text-slate-700">{selected.notes}</p>}</div>
          <div className="mt-4 space-y-2">{(selected.items || []).map((item) => <div key={item.id} className="flex gap-2 text-sm"><span className="text-slate-500">{item.quantity}×</span><span className="flex-1 font-medium text-slate-800">{item.item_name}{item.variant_name ? ` · ${item.variant_name}` : ''}{item.notes && <small className="block font-normal text-slate-500">{item.notes}</small>}</span><span>{money(item.subtotal)}</span></div>)}</div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="text-sm text-slate-500">Total estimate</span><strong className="text-xl">{money(selected.total_amount)}</strong></div>
          {selected.source === 'WHATSAPP' && <a href={`https://wa.me/${String(selected.customer_phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 text-sm font-semibold text-emerald-700"><MessageCircle className="h-4 w-4" />Open customer chat</a>}
          {['PENDING','ACCEPTED','READY'].includes(selected.status) && <div className="mt-4 border-t border-slate-200 pt-4">{selected.status === 'PENDING' && <div className="grid grid-cols-2 gap-2"><button disabled={!!busy} onClick={() => action('accept')} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 font-semibold text-white"><Check className="h-4 w-4" />Accept</button><button disabled={!!busy} onClick={() => action('reject')} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-300 font-semibold text-red-700"><XCircle className="h-4 w-4" />Reject</button></div>}{selected.status === 'ACCEPTED' && <button disabled={!!busy} onClick={() => action('ready')} className="h-11 w-full rounded-lg bg-emerald-600 font-semibold text-white">Mark ready</button>}{['ACCEPTED','READY'].includes(selected.status) && <Link href={`${basePath}/order/${selected.order_id}`} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 font-semibold text-slate-700">Open operational order <ExternalLink className="h-4 w-4" /></Link>}{(selected.status === 'PENDING' || selected.status === 'ACCEPTED' || selected.status === 'READY') && <><label className="mt-3 block text-xs font-semibold text-slate-600">Reason (required for reject/cancel)<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>{selected.status !== 'PENDING' && <button disabled={!!busy} onClick={() => action('cancel')} className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-red-700">Cancel request</button>}</>}</div>}
          {selected.audit?.length > 0 && <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Audit history ({selected.audit.length})</summary><div className="mt-3 space-y-2">{selected.audit.map((entry) => <div key={entry.id} className="text-xs text-slate-500"><strong className="text-slate-700">{entry.action}</strong> · {new Date(entry.created_at).toLocaleString()}{entry.reason ? ` · ${entry.reason}` : ''}</div>)}</div></details>}
        </>}</aside>
      </div>
    </div>
  </div>;
}
