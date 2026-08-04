'use client';

/**
 * Waiter dashboard — a quick read on the shift: sales, orders served, tables,
 * what's still waiting on the kitchen, and today's peak hours. Data comes from
 * /api/restaurant/waiter/stats (scoped to the signed-in waiter).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Banknote, ClipboardCheck, Users, TrendingUp, ChefHat,
  CheckCircle, Utensils, Clock, RefreshCw, LayoutGrid, History,
} from 'lucide-react';
import { authedRequest } from '@/lib/authed-fetch';
import { formatCurrency } from '@/lib/currency';

function Card({ icon: Icon, label, value, tone = 'gray' }) {
  const tones = {
    gray: 'text-gray-600', green: 'text-emerald-600', blue: 'text-blue-600',
    amber: 'text-amber-600', rose: 'text-rose-600', indigo: 'text-indigo-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <Icon className={`mb-2 h-6 w-6 ${tones[tone]}`} />
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
    </div>
  );
}

export default function WaiterDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedRequest('/api/restaurant/waiter/stats');
      const data = await res.json().catch(() => ({}));
      setStats(res.ok ? data.stats : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const s = stats || {};
  const peakMax = Math.max(1, ...((s.peak_hours || []).map((p) => p.count)));
  const hourLabel = (h) => {
    const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${am ? 'am' : 'pm'}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/waiter')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" /> <span className="font-semibold">Floor</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">My Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/waiter/history')} className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <History className="h-4 w-4" /> Order history
            </button>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {loading && !stats ? (
          <p className="py-16 text-center text-sm text-gray-500">Loading your numbers…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Card icon={Banknote} tone="green" label="Sales today" value={formatCurrency(s.sales_amount || 0)} />
              <Card icon={ClipboardCheck} tone="blue" label="Orders served" value={s.orders_served_today || 0} />
              <Card icon={TrendingUp} tone="indigo" label="Avg order value" value={formatCurrency(s.average_order_value || 0)} />
              <Card icon={Users} tone="gray" label="Tables handled" value={s.tables_handled || 0} />
              <Card icon={LayoutGrid} tone="rose" label="Active tables" value={s.active_tables || 0} />
              <Card icon={ChefHat} tone="amber" label="Waiting on kitchen" value={s.orders_waiting_kitchen || 0} />
              <Card icon={Utensils} tone="blue" label="Served / delivered" value={s.orders_delivered || 0} />
              <Card icon={CheckCircle} tone="green" label="Completed" value={s.completed_tables || 0} />
            </div>

            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Clock className="h-4 w-4 text-gray-500" /> Peak hours today
              </h2>
              {(!s.peak_hours || s.peak_hours.length === 0) ? (
                <p className="text-sm text-gray-400">No orders yet today.</p>
              ) : (
                <div className="space-y-2">
                  {s.peak_hours.map((p) => (
                    <div key={p.hour} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs font-semibold text-gray-600">{hourLabel(p.hour)}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(p.count / peakMax) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-bold text-gray-900">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
