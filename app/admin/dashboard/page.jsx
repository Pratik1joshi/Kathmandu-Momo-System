'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, LayoutGrid,
  AlertTriangle, PackageX, PackageMinus, Clock3, Receipt, CalendarClock,
  ShoppingBag, ChefHat, UserCheck, Boxes, Package, Award, Users, Sparkles,
  Sun, Sunrise, Sunset, Moon, Inbox,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { TrendChart } from '@/components/admin/report-kit';

function authedRequest(url) {
  const token = localStorage.getItem('pos_token');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

// ponytail: no restaurant-hours table exists yet — greeting/open-closed/shift are
// derived from the clock only. Swap for real settings if opening hours become configurable.
function useTimeContext() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const hour = now.getHours();
  let greeting = 'Good evening';
  let GreetingIcon = Moon;
  if (hour < 12) { greeting = 'Good morning'; GreetingIcon = Sunrise; }
  else if (hour < 17) { greeting = 'Good afternoon'; GreetingIcon = Sun; }
  else if (hour < 21) { greeting = 'Good evening'; GreetingIcon = Sunset; }
  else { greeting = 'Good night'; GreetingIcon = Moon; }
  const isOpen = hour >= 7 && hour < 23;
  const shift = hour < 12 ? 'Morning shift' : hour < 17 ? 'Afternoon shift' : hour < 23 ? 'Evening shift' : 'Closed';
  const timeLabel = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { greeting, GreetingIcon, isOpen, shift, timeLabel };
}

function GrowthBadge({ current, previous }) {
  if (previous == null || (!previous && !current)) return null;
  const growth = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const positive = growth >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{growth.toFixed(0)}% vs yesterday
    </span>
  );
}

const ATTENTION_META = {
  out_of_stock: { icon: PackageX, tone: 'text-red-600 bg-red-50' },
  low_stock: { icon: PackageMinus, tone: 'text-amber-600 bg-amber-50' },
  kitchen_delay: { icon: Clock3, tone: 'text-orange-600 bg-orange-50' },
  unpaid_bill: { icon: Receipt, tone: 'text-rose-600 bg-rose-50' },
  reservation_soon: { icon: CalendarClock, tone: 'text-blue-600 bg-blue-50' },
};

const ACTIVITY_META = {
  order_created: { icon: ShoppingBag, tone: 'text-blue-600 bg-blue-50' },
  kitchen_ready: { icon: ChefHat, tone: 'text-emerald-600 bg-emerald-50' },
  reservation_checked_in: { icon: UserCheck, tone: 'text-violet-600 bg-violet-50' },
  manual_restock: { icon: Boxes, tone: 'text-teal-600 bg-teal-50' },
  purchase_receipt: { icon: Boxes, tone: 'text-teal-600 bg-teal-50' },
  opening_balance: { icon: Boxes, tone: 'text-indigo-600 bg-indigo-50' },
  wastage: { icon: PackageX, tone: 'text-red-600 bg-red-50' },
  adjustment: { icon: Package, tone: 'text-gray-500 bg-gray-100' },
  manual_adjustment: { icon: Package, tone: 'text-gray-500 bg-gray-100' },
};

export default function AdminDashboard() {
  const router = useRouter();
  const { greeting, GreetingIcon, isOpen, shift, timeLabel } = useTimeContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await authedRequest('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const kpis = stats?.kpis;
  // The shared chart kit reads { label, sub, value }; the dashboard API speaks
  // { day, date, value }. One map keeps the kit as the single chart contract.
  const toSeries = (rows) => (rows || []).map((d) => ({ label: d.day, sub: d.date, value: d.value }));
  const revenueTrend = toSeries(stats?.revenueTrend);
  const orderVolume = toSeries(stats?.orderVolume);

  return (
    <AdminLayout>
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50">
              <GreetingIcon className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{greeting}</h1>
              <p className="text-gray-500 mt-0.5 text-sm">Here&apos;s what&apos;s happening in your restaurant today.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {isOpen ? 'Open' : 'Closed'}
            </span>
            <div className="text-right">
              <p className="font-semibold text-gray-800 tabular-nums">{timeLabel}</p>
              <p className="text-xs text-gray-400">{shift}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 space-y-6">
        {loading && !stats ? (
          <div className="text-center py-20 text-gray-500">Loading dashboard…</div>
        ) : (
          <>
            {/* Section 2 — Primary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 sm:p-3 rounded-lg bg-blue-50"><DollarSign className="w-5 h-5 text-blue-600" /></div>
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums truncate">{formatCurrency(kpis?.sales?.value || 0)}</h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">Sales Today</p>
                <div className="mt-1"><GrowthBadge current={kpis?.sales?.value || 0} previous={kpis?.sales?.prev} /></div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 sm:p-3 rounded-lg bg-violet-50"><ShoppingCart className="w-5 h-5 text-violet-600" /></div>
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums">{kpis?.orders?.value ?? 0}</h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">Orders Today</p>
                <div className="mt-1"><GrowthBadge current={kpis?.orders?.value || 0} previous={kpis?.orders?.prev} /></div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 sm:p-3 rounded-lg bg-emerald-50"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums truncate">{formatCurrency(kpis?.profit?.value || 0)}</h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">Profit Today</p>
                <div className="mt-1"><GrowthBadge current={kpis?.profit?.value || 0} previous={kpis?.profit?.prev} /></div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 sm:p-3 rounded-lg bg-cyan-50"><LayoutGrid className="w-5 h-5 text-cyan-600" /></div>
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                  {kpis?.occupiedTables?.value ?? 0}
                  <span className="text-base font-medium text-gray-400"> / {kpis?.occupiedTables?.total ?? 0}</span>
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">Occupied Tables</p>
              </div>
            </div>

            {/* Sections 3 & 4 — Needs Attention beside Today's Activity.
                One grid row from lg up; the default items-stretch makes both
                cards the height of the taller one, and each list scrolls inside
                its own card, so 2 items next to 15 still reads as a row rather
                than one short card and one very long one. The cap keeps a busy
                day from pushing everything below the fold. */}
            <div className="grid lg:grid-cols-2 gap-4 lg:max-h-[520px]">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-semibold text-gray-900">Needs Attention</h2>
                </div>
                {(stats?.needsAttention || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">All clear — nothing needs your attention right now.</p>
                ) : (
                  <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1 max-h-[420px] lg:max-h-none">
                    {stats.needsAttention.map((item, i) => {
                      const meta = ATTENTION_META[item.type] || { icon: AlertTriangle, tone: 'text-gray-500 bg-gray-100' };
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${meta.tone}`}><Icon className="w-4 h-4" /></div>
                          <p className="text-sm text-gray-700">{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col min-h-0">
                <h2 className="text-base font-semibold text-gray-900 mb-4 shrink-0">Today&apos;s Activity</h2>
                {(stats?.activity || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Nothing has happened yet today. As orders come in, they&apos;ll appear here.</p>
                ) : (
                  <div className="space-y-0 flex-1 min-h-0 overflow-y-auto pr-1 max-h-[420px] lg:max-h-none">
                    {stats.activity.map((item, i) => {
                      const meta = ACTIVITY_META[item.type] || { icon: Sparkles, tone: 'text-gray-500 bg-gray-100' };
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${meta.tone}`}><Icon className="w-4 h-4" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800">{item.text}</p>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{item.atLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 5 — Business Overview */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-5">Revenue Trend</h2>
                {revenueTrend.every((d) => d.value === 0) ? (
                  <p className="text-sm text-gray-500 py-10 text-center">No sales yet this week.</p>
                ) : (
                  <TrendChart data={revenueTrend} color="blue" format="currency" height={180} />
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-5">Order Volume</h2>
                {orderVolume.every((d) => d.value === 0) ? (
                  <p className="text-sm text-gray-500 py-10 text-center">No orders yet this week.</p>
                ) : (
                  <TrendChart data={orderVolume} color="slate" format="number" height={180} />
                )}
              </div>
            </div>

            {/* Section 6 — Performance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-amber-50"><Award className="w-4 h-4 text-amber-600" /></div>
                  <p className="text-xs font-medium text-gray-500">Top Selling Item</p>
                </div>
                {stats?.performance?.topItem ? (
                  <>
                    <p className="text-lg font-semibold text-gray-900 truncate">{stats.performance.topItem.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stats.performance.topItem.qty} sold today</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No item sales yet today.</p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-green-50"><Users className="w-4 h-4 text-green-600" /></div>
                  <p className="text-xs font-medium text-gray-500">Best Employee</p>
                </div>
                {stats?.performance?.bestEmployee ? (
                  <>
                    <p className="text-lg font-semibold text-gray-900 truncate">{stats.performance.bestEmployee.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stats.performance.bestEmployee.orders} orders today</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No orders logged to a waiter yet today.</p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-cyan-50"><LayoutGrid className="w-4 h-4 text-cyan-600" /></div>
                  <p className="text-xs font-medium text-gray-500">Most Occupied Table</p>
                </div>
                {stats?.performance?.busiestTable ? (
                  <>
                    <p className="text-lg font-semibold text-gray-900 truncate">Table {stats.performance.busiestTable.table}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stats.performance.busiestTable.orders} orders today</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No table activity yet today.</p>
                )}
              </div>
            </div>

            {/* Section 7 — Inventory Snapshot */}
            {(stats?.inventorySnapshot || []).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Inventory Snapshot</h2>
                  <button
                    onClick={() => router.push('/admin/inventory')}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    View Inventory
                  </button>
                </div>
                <div className="space-y-1">
                  {stats.inventorySnapshot.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${item.status === 'out' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <span className="text-sm font-medium text-gray-800">{item.name}</span>
                      </div>
                      <span className={`text-sm font-semibold ${item.status === 'out' ? 'text-red-600' : 'text-amber-600'}`}>
                        {item.qty} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 8 — Reservation Snapshot */}
            {stats?.reservations && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Reservation Snapshot</h2>
                  <button
                    onClick={() => router.push('/admin/leads')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <Inbox className="w-3.5 h-3.5" /> Open Host Desk
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-xl bg-blue-50 py-4">
                    <p className="text-2xl font-bold text-blue-700 tabular-nums">{stats.reservations.upcoming}</p>
                    <p className="text-xs text-blue-600 mt-1">Upcoming</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 py-4">
                    <p className="text-2xl font-bold text-amber-700 tabular-nums">{stats.reservations.waiting}</p>
                    <p className="text-xs text-amber-600 mt-1">Waiting</p>
                  </div>
                  <div className="rounded-xl bg-gray-100 py-4">
                    <p className="text-2xl font-bold text-gray-700 tabular-nums">{stats.reservations.cancelled}</p>
                    <p className="text-xs text-gray-500 mt-1">Cancelled</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
