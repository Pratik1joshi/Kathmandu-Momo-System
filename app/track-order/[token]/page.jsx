'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function TrackOnlineOrderPage() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/public/online-orders/${token}`);
      const data = await response.json();
      if (!active) return;
      if (response.ok) setOrder(data.order); else setError(data.error || 'Could not load this request.');
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);
  return <main className="flex min-h-screen items-center justify-center bg-[#fffcf7] p-4"><section className="w-full max-w-lg rounded-[12px] border border-[#e4dfd4] bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8a8276]">Kathmandu Momo</p><h1 className="mt-2 text-2xl font-semibold">Order request status</h1>{error ? <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : !order ? <div className="mt-6 h-28 animate-pulse rounded-lg bg-slate-100" /> : <><div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-4"><div><p className="font-mono font-semibold">{order.reference}</p><p className="mt-1 text-sm text-slate-500">{order.source} · {order.fulfillment_method}</p></div><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{order.status}</span></div><p className="mt-4 text-sm leading-6 text-slate-600">Payment: <strong>{order.payment_status}</strong>. {order.status === 'PENDING' ? 'Kathmandu Momo has not accepted preparation yet.' : order.status === 'ACCEPTED' ? 'Your request has been accepted for preparation.' : order.status === 'READY' ? 'Your order is ready; please follow the restaurant instructions.' : order.status === 'COMPLETED' ? 'This order is complete.' : 'Contact Kathmandu Momo if you need help with this request.'}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-4">{order.items.map((item) => <div key={item.id} className="flex text-sm"><span className="text-slate-500">{item.quantity}×</span><span className="ml-2 flex-1 font-medium">{item.item_name}</span><span>Rs {Number(item.subtotal).toLocaleString()}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-500">Estimated total</span><strong>Rs {Number(order.total_amount).toLocaleString()}</strong></div></>}<Link href="/order-online" className="mt-6 block rounded-lg bg-slate-900 py-3 text-center font-semibold text-white">Back to online ordering</Link></section></main>;
}
