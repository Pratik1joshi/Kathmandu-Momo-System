'use client';

import Link from 'next/link';
import {
  ArrowRight, CircleDollarSign, CreditCard, PackageSearch,
  ShoppingBasket, WalletCards,
} from 'lucide-react';
import { ChartCard, RankBars, TrendChart, formatValue } from '@/components/admin/report-kit';
import DonutChart, { DEFAULT_COLORS } from '@/components/admin/donut-chart';
import { financialToneClass } from '@/lib/financial-tone';

const money = (value) => formatValue(value, 'currency');
const number = (value) => formatValue(value, 'number');
const percent = (value) => formatValue(value, 'percent');

const tones = {
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
};

export function AnalyticsKeyMetrics({ data }) {
  const finance = data.finance || {};
  const totals = data.totals || {};
  const inventory = data.inventory || {};
  const averageOrder = totals.bills ? totals.billedTotal / totals.bills : 0;
  const openingBalance = data.businessDayMetrics?.openingCash ?? finance.openingBalance;
  const metrics = [
    ['Opening Balance', openingBalance, 'currency', 'Drawer at opening'],
    ['Total Item Sales', totals.itemSales, 'currency', 'Before customer discounts'],
    ['Less: Discounts', totals.discounts, 'currency', 'Customer discounts'],
    ['Net Item Sales', totals.netItemSales, 'currency', 'After customer discounts'],
    ['Ledger Collections', finance.ledgerCollections, 'currency', 'Past dues paid'],
    ['Total Purchases', inventory.purchaseValue, 'currency', `${number(inventory.purchases)} records`],
    ['Total Expenses', finance.operatingExpenses, 'currency', 'Operating expenses'],
    ['Total Deposit', finance.totalDeposits, 'currency', `${number(finance.depositCount)} deposits`],
    ['Net Profit', finance.operatingProfit, 'currency', 'After operating expenses'],
    ['Profit Margin', finance.profitMargin, 'percent', 'Of total sales'],
    ['Avg Order', averageOrder, 'currency', `${number(totals.bills)} bills`],
    ['Net Revenue', totals.netSales, 'currency', 'After refunds; tax/service included'],
  ];

  return (
    <section aria-label="Key financial figures" className="mb-5 overflow-hidden rounded-lg border border-gray-200 bg-gray-200 shadow-sm">
      <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map(([label, value, format, detail]) => {
          const isHeadline = label === 'Net Profit';
          return (
            <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${isHeadline ? 'bg-emerald-50/60' : 'bg-white'}`}>
              <p className="truncate text-xs font-medium text-gray-500">{label}</p>
              <p className={`mt-1.5 truncate text-xl font-semibold tabular-nums ${format === 'currency' ? financialToneClass({ label, value }) : 'text-gray-950'}`} title={String(value ?? 0)}>
                {format === 'percent' ? percent(value) : money(value)}
              </p>
              <p className="mt-1 truncate text-xs text-gray-400">{detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OverviewCard({ title, icon: Icon, tone, moneyTone, href, value, detail, children }) {
  return (
    <Link href={href} className="group flex min-h-[154px] flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-[border-color,transform] duration-150 ease-out hover:border-gray-300 active:scale-[0.98]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
      </div>
      <p className={`mt-4 text-2xl font-semibold tabular-nums ${moneyTone || 'text-gray-950'}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
      {children}
    </Link>
  );
}

export default function AnalyticsHome({ data }) {
  const finance = data.finance || {};
  const totals = data.totals || {};
  const inventory = data.inventory || {};
  const payments = data.payments || {};
  const tableEarnings = (data.tables?.rows || []).slice(0, 7).map((row) => ({
    label: `Table ${row.table_number}`,
    value: row.revenue,
    meta: `${number(row.orders)} order${Number(row.orders) === 1 ? '' : 's'}`,
  }));
  const paymentTotal = Number(payments.cashCollected || 0) + Number(payments.onlineCollected || 0);
  const cashShare = paymentTotal ? Math.min(100, (Number(payments.cashCollected || 0) / paymentTotal) * 100) : 0;
  const purchasing = data.suppliers?.purchasing || {};
  const chartRows = {
    payments: (payments.methods || []).map((row) => ({ label: row.label, value: row.amount, meta: `${number(row.transactions)} transactions` })),
    salesCategories: (data.sales?.byCategory || []).map((row) => ({ label: row.label, value: row.value, meta: row.meta })),
    masterCategories: (data.sales?.byGroup || []).map((row) => ({ label: row.label, value: row.value, meta: `${number(row.quantity)} sold` })),
    purchaseCategories: (purchasing.purchases?.categories || []).map((row) => ({ label: row.category, value: row.amount, meta: percent(row.share) })),
    expenseCategories: (purchasing.expenses?.categories || []).map((row) => ({ label: row.category, value: row.amount, meta: percent(row.share) })),
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">Overview</h2>
        <p className="mt-0.5 text-sm text-gray-500">Sales, spending, stock and restaurant performance at a glance.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Business overview">
        <OverviewCard title="Payments" icon={CreditCard} tone="blue" moneyTone="text-emerald-700" href="/admin/reports?tab=finance" value={money(payments.grossCollected)} detail={`${money(payments.cashCollected)} cash · ${money(payments.onlineCollected)} online`}>
          <div className="mt-auto flex h-1.5 overflow-hidden rounded-full bg-gray-100" aria-label={`${Math.round(cashShare)} percent cash`}>
            <span className="bg-blue-600" style={{ width: `${cashShare}%` }} />
            <span className="flex-1 bg-cyan-400" />
          </div>
        </OverviewCard>
        <OverviewCard title="Purchases" icon={ShoppingBasket} tone="amber" moneyTone="text-rose-700" href="/admin/purchases" value={money(inventory.purchaseValue)} detail={`${number(inventory.purchases)} purchase records`} />
        <OverviewCard title="Sales" icon={CircleDollarSign} tone="emerald" moneyTone="text-emerald-700" href="/admin/reports?tab=sales" value={money(totals.netItemSales)} detail={`${money(totals.itemSales)} total − ${money(totals.discounts)} discounts${data.live?.openOrdersValue > 0 ? ` · +${money(data.live.openOrdersValue)} on open tables` : ''}`} />
        <OverviewCard title="Expenses" icon={WalletCards} tone="rose" moneyTone="text-rose-700" href="/admin/expenses" value={money(finance.operatingExpenses)} detail={`Food cost ${money(finance.cogs)}`} />
        <OverviewCard title="Stock" icon={PackageSearch} tone="violet" href="/admin/inventory" value={money(inventory.value)} detail={`${number(inventory.low)} low stock · ${number(inventory.out)} out`} />
      </section>

      <section aria-label="Visual business breakdown" className="border-t border-gray-200 pt-7">
        <div className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Visual dashboard</p><h2 className="mt-1 text-lg font-semibold text-gray-950">What is driving the business</h2><p className="mt-1 text-sm text-gray-500">Hover, tap, or focus a donut segment to inspect its share.</p></div>
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Sales Trend" hint="Net item sales by day" isEmpty={!data.sales?.trend?.length} empty="No settled sales in this period." className="xl:col-span-2">
            <TrendChart data={data.sales?.trend || []} color="blue" format="currency" height={250} />
          </ChartCard>
          <VisualDonut title="Payment Methods" rows={chartRows.payments} centerLabel="Collected" />
          <VisualDonut title="Sales by Category" rows={chartRows.salesCategories} centerLabel="Sales" />
          <VisualDonut title="Sales by Master Category" rows={chartRows.masterCategories} centerLabel="Sales" />
          <VisualDonut title="Purchases by Category" rows={chartRows.purchaseCategories} centerLabel="Purchases" />
          <VisualDonut title="Expenses by Category" rows={chartRows.expenseCategories} centerLabel="Expenses" />
          <ChartCard title="Table Earnings" hint="Revenue earned by each dine-in table" isEmpty={!tableEarnings.length} empty="No settled table sales in this period.">
            <RankBars data={tableEarnings} color="blue" format="currency" limit={7} />
          </ChartCard>
        </div>
      </section>
    </div>
  );
}

function VisualDonut({ title, rows = [], centerLabel }) {
  const usableRows = rows.filter((row) => Number(row.value || 0) > 0).slice(0, 8);
  const total = usableRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const segments = usableRows.map((row, index) => ({ ...row, color: DEFAULT_COLORS[index % DEFAULT_COLORS.length] }));
  return <ChartCard title={title} isEmpty={!segments.length} empty={`No ${title.toLowerCase()} in this period.`}><div className="grid items-center gap-5 sm:grid-cols-[190px_minmax(0,1fr)]"><DonutChart segments={segments} size={190} thickness={28} centerLabel={centerLabel} centerValue={money(total)} /><div className="max-h-[210px] space-y-2.5 overflow-auto pr-2">{segments.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 inline-flex items-center gap-1.5 text-gray-600"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} /><span className="truncate">{row.label}</span></span><span className="shrink-0 text-right"><span className="block font-medium tabular-nums text-gray-900">{money(row.value)}</span>{row.meta && <span className="block text-[10px] text-gray-400">{row.meta}</span>}</span></div>)}</div></div></ChartCard>;
}
