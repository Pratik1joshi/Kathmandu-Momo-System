'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShoppingBag, Plus, Minus, X, CheckCircle2, Clock, Leaf, Loader2 } from 'lucide-react';

const rs = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

export default function CustomerOrderPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({}); // id -> {item, qty}
  const [showCart, setShowCart] = useState(false);
  const [name, setName] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null); // { order_id, order_number }
  const [track, setTrack] = useState(null);
  const [activeCat, setActiveCat] = useState('');
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/public/order/${token}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not load menu.');
      setData(d);
      setActiveCat((c) => c || d.categories?.[0]?.id || '');
      if (d.active_order) setPlaced({ order_id: d.active_order.order_id, order_number: d.active_order.order_number });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  // Poll order status once an order exists.
  useEffect(() => {
    if (!placed?.order_id) return undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/public/order/${token}?order_id=${placed.order_id}`);
        const d = await res.json();
        if (res.ok) setTrack(d.order);
      } catch { /* ignore */ }
    };
    tick();
    pollRef.current = setInterval(tick, 10000);
    return () => clearInterval(pollRef.current);
  }, [placed, token]);

  const items = useMemo(() => Object.values(cart), [cart]);
  const count = items.reduce((s, x) => s + x.qty, 0);
  const total = items.reduce((s, x) => s + x.qty * Number(x.item.price || 0), 0);

  const add = (item) => setCart((c) => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty || 0) + 1 } }));
  const dec = (item) => setCart((c) => {
    const q = (c[item.id]?.qty || 0) - 1;
    const next = { ...c };
    if (q <= 0) delete next[item.id];
    else next[item.id] = { item, qty: q };
    return next;
  });

  const place = async () => {
    setPlacing(true);
    try {
      const res = await fetch(`/api/public/order/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: name || null, items: items.map((x) => ({ menu_item_id: x.item.id, quantity: x.qty })) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not place order.');
      setCart({});
      setShowCart(false);
      setPlaced({ order_id: d.order_id, order_number: d.order_number });
    } catch (e) {
      alert(e.message);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <Splash><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></Splash>;
  if (error) return <Splash><div className="text-center"><p className="text-lg font-semibold text-slate-800">{error}</p><p className="mt-1 text-sm text-slate-500">Please ask a member of staff for help.</p></div></Splash>;

  const cats = data.categories || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Table {data.table?.number || '—'}{data.table?.floor ? ` · ${data.table.floor}` : ''}</p>
          <h1 className="text-xl font-bold text-slate-900">Order from your table</h1>
        </div>
        <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-2">
          {cats.map((c) => (
            <button key={c.id} onClick={() => { setActiveCat(c.id); document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${activeCat === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {c.title}
            </button>
          ))}
        </div>
      </header>

      {data.ordering_enabled === false && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Self-ordering is paused right now. Browse the menu and a member of staff will take your order.
          </div>
        </div>
      )}

      {placed && track && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              {track.status === 'ready' || track.status === 'served' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              <p className="font-semibold">{track.status_label}</p>
            </div>
            <p className="mt-1 text-sm text-emerald-700">Order {track.order_number} · {track.items?.reduce((s, i) => s + i.quantity, 0)} item(s). Add more below anytime.</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 py-4">
        {cats.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="mb-6 scroll-mt-28">
            <h2 className="mb-3 text-lg font-bold text-slate-900">{cat.title}</h2>
            <div className="space-y-3">
              {cat.items.map((item) => {
                const qty = cart[item.id]?.qty || 0;
                return (
                  <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300"><ShoppingBag className="h-6 w-6" /></div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start gap-1">
                        {item.diet === 'veg' && <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      </div>
                      {item.description && <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="font-bold text-slate-900">{rs(item.price)}</span>
                        {qty === 0 ? (
                          <button onClick={() => add(item)} className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white">Add</button>
                        ) : (
                          <div className="flex items-center gap-3 rounded-lg bg-slate-900 px-2 py-1 text-white">
                            <button onClick={() => dec(item)} aria-label="Remove one"><Minus className="h-4 w-4" /></button>
                            <span className="min-w-4 text-center text-sm font-bold">{qty}</span>
                            <button onClick={() => add(item)} aria-label="Add one"><Plus className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {cats.length === 0 && <p className="py-16 text-center text-slate-500">The menu is being updated. Please check back shortly.</p>}
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setShowCart(true)} className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-xl bg-slate-900 px-5 py-3.5 text-white">
            <span className="flex items-center gap-2 font-semibold"><ShoppingBag className="h-5 w-5" /> {count} item{count > 1 ? 's' : ''}</span>
            <span className="font-bold">{rs(total)} · Review</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setShowCart(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Your order</h2>
              <button onClick={() => setShowCart(false)} className="rounded-lg p-1 text-slate-400"><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-3">
              {items.map((x) => (
                <div key={x.item.id} className="flex items-center gap-3">
                  <div className="flex-1"><p className="font-medium text-slate-900">{x.item.name}</p><p className="text-xs text-slate-500">{rs(x.item.price)}</p></div>
                  <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-2 py-1">
                    <button onClick={() => dec(x.item)}><Minus className="h-4 w-4 text-slate-700" /></button>
                    <span className="min-w-4 text-center text-sm font-bold">{x.qty}</span>
                    <button onClick={() => add(x.item)}><Plus className="h-4 w-4 text-slate-700" /></button>
                  </div>
                  <span className="w-20 text-right font-semibold text-slate-900">{rs(x.qty * x.item.price)}</span>
                </div>
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="mt-4 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm" />
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-xl font-bold text-slate-900">{rs(total)}</span>
            </div>
            <button disabled={placing} onClick={place} className="mt-4 h-14 w-full rounded-2xl bg-amber-500 text-lg font-bold text-white disabled:opacity-60">
              {placing ? 'Sending…' : placed ? 'Add to my order' : 'Place order'}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Your order goes straight to the kitchen. Pay at the counter or ask staff.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Splash({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">{children}</div>;
}
