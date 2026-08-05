'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Copy, MessageCircle, Minus, Plus, ShoppingBag, X } from 'lucide-react';

const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-NP')}`;
const newKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export default function OnlineCheckout({ categories }) {
  const [cart, setCart] = useState({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', fulfillment: 'PICKUP', notes: '' });
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const lines = useMemo(() => Object.values(cart), [cart]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.quantity * Number(line.item.price), 0);

  const change = (item, delta) => setCart((current) => {
    const next = { ...current };
    const quantity = (next[item.id]?.quantity || 0) + delta;
    if (quantity <= 0) delete next[item.id];
    else next[item.id] = { item, quantity };
    return next;
  });

  async function submit(source) {
    setError('');
    setBusy(source);
    try {
      const response = await fetch('/api/public/online-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          idempotency_key: key,
          customer_name: form.name,
          customer_phone: form.phone,
          fulfillment_method: form.fulfillment,
          notes: form.notes,
          items: lines.map((line) => ({ menu_item_id: line.item.id, quantity: line.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok && !data.reference) throw new Error(data.error || 'Could not save your order request.');
      setResult(data);
      if (source === 'WHATSAPP' && data.whatsapp_url) window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  function startAnother() {
    setResult(null); setCart({}); setOpen(false); setKey(newKey()); setError('');
  }

  return (
    <div className="min-h-screen bg-[#fffcf7] text-[#1c1a16]">
      <header className="sticky top-0 z-30 border-b border-[#e4dfd4] bg-[#fffcf7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          <div><p className="text-lg font-semibold">Kathmandu Momo</p><p className="text-[10px] uppercase tracking-[0.18em] text-[#8a8276]">Online ordering</p></div>
          <Link href="/menu" className="rounded-[8px] border border-[#d4cbb8] px-3 py-2 text-xs font-semibold">View menu only</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a8f7a]">Pickup request</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your food, then send it your way.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#6e675c]">Website and WhatsApp requests use the same live POS menu. Your order is prepared only after Kathmandu Momo confirms it.</p>
        </div>
        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category.id}>
              <div className="mb-3 flex items-end justify-between border-b border-[#e4dfd4] pb-2"><h2 className="text-xl font-semibold">{category.title}</h2><span className="text-xs text-[#8a8276]">{category.items.length} items</span></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((item) => {
                  const quantity = cart[item.id]?.quantity || 0;
                  return <article key={item.id} className="flex min-h-32 gap-3 rounded-[10px] border border-[#e4dfd4] bg-white p-3">
                    <OrderItemImage item={item} />
                    <div className="flex min-w-0 flex-1 flex-col"><h3 className="font-semibold leading-tight">{item.name}</h3><p className="mt-1 line-clamp-2 text-xs text-[#7a7266]">{item.description}</p><div className="mt-auto flex items-center justify-between pt-2"><strong className="text-sm">{money(item.price)}</strong>{quantity ? <div className="flex items-center gap-2 rounded-[8px] bg-[#1c1a16] px-2 py-1 text-white"><button onClick={() => change(item, -1)} aria-label={`Remove one ${item.name}`}><Minus className="h-4 w-4" /></button><span className="min-w-4 text-center text-sm">{quantity}</span><button onClick={() => change(item, 1)} aria-label={`Add one ${item.name}`}><Plus className="h-4 w-4" /></button></div> : <button onClick={() => change(item, 1)} className="rounded-[8px] bg-[#1c1a16] px-3 py-1.5 text-xs font-semibold text-white active:scale-[.97]">Add</button>}</div></div>
                  </article>;
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
      {count > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e4dfd4] bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"><button onClick={() => setOpen(true)} className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-[10px] bg-[#d34b2c] px-5 py-3.5 font-semibold text-white active:scale-[.99]"><span>{count} item{count === 1 ? '' : 's'}</span><span>{money(total)} · Checkout</span></button></div>}
      {open && <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"><button aria-label="Close checkout" onClick={() => !busy && setOpen(false)} className="absolute inset-0 bg-black/40" /><section className="relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[16px] bg-white p-5 sm:rounded-[16px]">
        <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.15em] text-[#8a8276]">Your order</p><h2 className="text-xl font-semibold">Review and send</h2></div><button onClick={() => setOpen(false)} className="rounded-[8px] p-2"><X className="h-5 w-5" /></button></div>
        {result ? <Success result={result} onReset={startAnother} /> : <>
          <div className="mt-5 space-y-2 border-y border-[#eee8df] py-4">{lines.map((line) => <div key={line.item.id} className="flex gap-3 text-sm"><span className="text-[#7a7266]">{line.quantity}×</span><span className="flex-1 font-medium">{line.item.name}</span><span>{money(line.quantity * line.item.price)}</span></div>)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-11 w-full rounded-[8px] border border-[#d4cbb8] px-3 text-sm" required /></label><label className="text-xs font-semibold">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" className="mt-1 h-11 w-full rounded-[8px] border border-[#d4cbb8] px-3 text-sm" required /></label></div>
          <label className="mt-3 block text-xs font-semibold">Fulfillment<select value={form.fulfillment} onChange={(e) => setForm({ ...form, fulfillment: e.target.value })} className="mt-1 h-11 w-full rounded-[8px] border border-[#d4cbb8] px-3 text-sm"><option value="PICKUP">Pickup</option><option value="DINE_IN">Dine-in request</option></select></label>
          <label className="mt-3 block text-xs font-semibold">Order notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} className="mt-1 min-h-20 w-full rounded-[8px] border border-[#d4cbb8] p-3 text-sm" placeholder="Allergies or preparation notes" /></label>
          <div className="mt-4 flex items-center justify-between border-t border-[#eee8df] pt-4"><span className="text-sm text-[#7a7266]">Server-verified estimate</span><strong className="text-xl">{money(total)}</strong></div>
          {error && <p role="alert" className="mt-3 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button disabled={!!busy} onClick={() => submit('WEBSITE')} className="h-12 rounded-[8px] bg-[#1c1a16] px-4 font-semibold text-white disabled:opacity-50">{busy === 'WEBSITE' ? 'Saving…' : 'Submit on website'}</button><button disabled={!!busy} onClick={() => submit('WHATSAPP')} className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#197b55] px-4 font-semibold text-white disabled:opacity-50"><MessageCircle className="h-5 w-5" />{busy === 'WHATSAPP' ? 'Saving…' : 'Order via WhatsApp'}</button></div>
          <p className="mt-3 text-center text-xs leading-5 text-[#8a8276]">Submitting does not confirm preparation or payment. We will contact you after staff review.</p>
        </>}
      </section></div>}
    </div>
  );
}

function OrderItemImage({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) return <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[8px] bg-[#f0ebe3]"><ShoppingBag className="h-5 w-5 text-[#9a8f7a]" /></div>;
  return <Image src={item.image} alt="" width={96} height={96} onError={() => setFailed(true)} className="h-24 w-24 shrink-0 rounded-[8px] object-cover" />;
}

function Success({ result, onReset }) {
  const copy = () => navigator.clipboard?.writeText(result.reference || '');
  return <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h3 className="mt-3 text-xl font-semibold">Request saved</h3><p className="mt-2 text-sm leading-6 text-[#6e675c]">{result.message || result.error}</p><button onClick={copy} className="mx-auto mt-5 flex items-center gap-2 rounded-[8px] border border-[#d4cbb8] px-4 py-3"><span className="font-mono font-semibold">{result.reference}</span><Copy className="h-4 w-4" /></button>{result.lookup_token && <Link href={`/track-order/${result.lookup_token}`} className="mx-auto mt-3 block w-fit rounded-[8px] border border-[#d4cbb8] px-4 py-3 font-semibold">Track this request</Link>}{result.whatsapp_url && <a href={result.whatsapp_url} target="_blank" rel="noreferrer" className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-[8px] bg-[#197b55] px-4 py-3 font-semibold text-white"><MessageCircle className="h-5 w-5" />Open WhatsApp again</a>}<button onClick={onReset} className="mt-6 block w-full rounded-[8px] bg-[#1c1a16] py-3 font-semibold text-white">Start another order</button></div>;
}
