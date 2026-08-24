'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Printer, RefreshCw } from 'lucide-react';
import { apiJson } from '@/lib/authed-fetch';
import { formatNepalDateTime, formatNepalDisplay, nepalDateString } from '@/lib/report-dates';
import DateInput from '@/components/ui/date-input.jsx';
import {
  Account, CashFlowCard, Category, CountedCash, DigitalReceipts, ExchangeCard,
  MoneyPosition, PrintColorStyle, QuantitySummary, ReportGroup, ReportHeader,
  Section, line, printColorClass,
} from '@/components/admin/summary-kit.jsx';

export default function SummaryReportPage(){
  const today=nepalDateString();
  const [period,setPeriod]=useState('today'); const [from,setFrom]=useState(today); const [to,setTo]=useState(today);
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=useCallback(async(p=period)=>{setLoading(true);setError('');try{const query=p==='custom'?`period=custom&startDate=${from}&endDate=${to}`:`period=${p}`;setData(await apiJson(`/api/admin/summary-report?${query}`));}catch(e){setError(e.message||'Could not load report.');}finally{setLoading(false)}},[period,from,to]);
  useEffect(()=>{load()},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose=(p)=>{setPeriod(p);setTimeout(()=>load(p),0)};
  const d=data;
  return <AdminLayout>
    <PrintColorStyle/>
    <header className="print:hidden border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">Summary Report</h1><p className="mt-1 text-sm text-gray-500">What the business took, spent and was left with over the period — built from the accounting ledger.</p></div><div className="flex gap-2"><button onClick={()=>window.print()} className={BTN}><Printer className="h-4 w-4"/>Print</button><button onClick={()=>load()} disabled={loading} className={BTN}><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button></div></div>
      <div className="mt-5 flex flex-wrap items-end gap-2">{[['today','Today'],['this_week','This Week'],['this_month','This Month'],['year','This Year']].map(([p,l])=><button key={p} onClick={()=>choose(p)} className={`${FILTER} ${period===p?'bg-gray-900 text-white':'bg-white text-gray-700'}`}>{l}</button>)}<label className={LABEL}>From<DateInput value={from} onChange={setFrom} className={INPUT}/></label><span className="pb-2 text-gray-400">-</span><label className={LABEL}>To<DateInput value={to} onChange={setTo} className={INPUT}/></label><button onClick={()=>{setPeriod('custom');load('custom')}} className={`${FILTER} bg-gray-900 text-white`}>Apply</button><button onClick={()=>{setFrom(today);setTo(today);choose('today')}} className={FILTER}>Reset</button></div>
    </header>
    <main className="bg-gray-50 p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
      {error&&<div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading&&!d?<div className="py-24 text-center text-sm text-gray-500">Building the report...</div>:d&&<div className={`mx-auto max-w-7xl bg-white p-5 shadow-sm print:max-w-none print:p-0 print:shadow-none ${printColorClass}`}>
        <ReportHeader
          restaurantName={d.restaurant_name}
          title="Summary Report"
          rangeText={`${formatNepalDisplay(d.range.start)} - ${formatNepalDisplay(d.range.end)}`}
          generatedText={`Generated ${formatNepalDateTime(d.generated_at)} NPT`}
        />
        <ReportGroup title="Money In" note="Everything the restaurant earned and collected in this period." tint="emerald">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Section highlight tint="emerald" title="Restaurant Revenue" note="Gross sales show original finalized bills. Net revenue subtracts refunds and voided bills." rows={[line('Gross Cash Sales',d.revenue.cash),line('Gross Bank / Online Sales',d.revenue.bank),line('Gross Credit Sales',d.revenue.credit),line('of which Service / Extra Charges',d.revenue.service_charge),line('Gross Sales',d.revenue.gross),line(`Refunds (${d.revenue.refund_count||0})`,d.revenue.refunds,'-'),line(`Voided Bills (${d.revenue.void_count||0})`,d.revenue.voids,'-'),line('Net Revenue',d.revenue.net)]}/>
          <Section highlight tint="sky" title="Payment Received" note="Net received is the money retained after cash/bank refunds and void reversals." rows={[line('Gross Collected',d.received.gross_total),line('Cash Refunds / Void Returns',d.received.refund_cash+d.received.void_cash,'-'),line('Bank Refunds / Void Returns',d.received.refund_bank+d.received.void_bank,'-'),line('Net Cash Retained',d.received.cash),line('Net Bank Retained',d.received.bank),line('Net Received',d.received.total)]}/>
          <Section title="Customer Ledger Payments" rows={[line('Cash Received',d.ledger.cash),line('Bank Received',d.ledger.bank),line('Total Received',d.ledger.cash+d.ledger.bank)]}/>
        </div>
        <div className="mt-5"><DigitalReceipts tint="sky" data={d.digital||{}}/></div>
        </ReportGroup>
        <ReportGroup title="Money Out" note="Everything paid out — stock, running costs and wages." tint="pink">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Section title="Total Purchase" rows={[line('Cash',d.purchases.cash),line('Bank Transfer',d.purchases.bank),line('Credit Purchase',d.purchases.credit),line('Total Purchase',d.purchases.total)]}/>
          <Section title="Total Expense" rows={[line('Cash',d.expenses.cash),line('Bank Transfer',d.expenses.bank),line('Credit Expense',d.expenses.credit),line('Total Expense',d.expenses.total)]}/>
          <Section title="Total Salary Paid" rows={[line('Cash / bank paid now',d.salary.cash+d.salary.bank),line('Advance deductions',d.salary.advance_deductions),line('Gross salary expense',d.salary.total)]}/>
        </div>
        </ReportGroup>
        <ReportGroup title="Cash Position" note="Where the money sits now, and how the drawer reconciles." tint="amber">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <MoneyPosition tint="indigo" data={d.money_position||{}}/>
          <Account highlight tint="amber" title="Cash in Hand" data={d.accounts.cash}/>
          <CashFlowCard tint="amber" data={d.cash_flow||{}}/>
          <CountedCash tint="violet" data={d.closing||{}}/>
          <Section title="Cash Register" rows={[line('Cash In',d.cash_register.cash_in),line('Cash Out',d.cash_register.cash_out),line('Savings Deposit',d.cash_register.deposit)]}/>
          <Account title="Cash in Bank / Online" data={d.accounts.bank}/>
          <Section title="Savings / Deposits" note="Transfers to savings are cash movements, not business expenses." rows={[line('From Cash',d.savings.cash),line('From Online / QR',d.savings.online),line('Total Saved',d.savings.total)]}/>
          <ExchangeCard data={d.exchange}/>
          <Section title="Net Exchange" note="Positive means net income from exchange fees." rows={[line('Total Impact',d.exchange.net)]}/>
        </div>
        </ReportGroup>
        <ReportGroup title="Profitability" note="What is left after cost of food and running the place." tint="indigo">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Section highlight tint="blue" title="Profit & Loss" note="Refunds reduce revenue. Refunded food remains in food cost because a refund does not restore consumed stock; a void does." rows={[line('Net Revenue after Refunds / Voids',d.profit.revenue,'',d.profit.revenue<0?'negative':'positive'),line('Estimated Food Cost',d.profit.food_cost,'-'),line('Estimated Gross Profit',d.profit.gross),line('Operating Expenses & Salary',d.profit.operating,'-'),line('Estimated Net Profit',d.profit.net,d.profit.net>=0?'+':'')]}/>
          <Section title="Sales - Expense" note="Net revenue minus operating expenses & salary, without subtracting food cost." rows={[line('Net Revenue',d.profit.revenue,'',d.profit.revenue<0?'negative':'positive'),line('Operating Expenses & Salary',d.profit.operating,'-'),line('Result',d.profit.revenue-d.profit.operating,'',(d.profit.revenue-d.profit.operating)<0?'negative':'positive')]}/>
        </div>
        </ReportGroup>
        <ReportGroup title="Category Breakdown" note="Where the sales and the purchases actually came from." tint="emerald">
        <div className="grid gap-5 lg:grid-cols-2"><Category title="Gross Sale Category (before refunds)" rows={d.sale_categories}/><Category title="Purchase Category" rows={d.purchase_categories}/></div>
        </ReportGroup>
        <QuantitySummary items={{'Sold Item Quantity':d.quantities.sold,'Purchase Quantity':d.quantities.purchased,Bills:d.quantities.bills,Orders:d.quantities.orders,KOTs:d.quantities.kots,'Expense Records':d.quantities.expenses,'Salary Records':d.quantities.salary,'Savings Records':d.quantities.savings}}/>
      </div>}
    </main>
  </AdminLayout>
}

const BTN='inline-flex h-10 items-center gap-2 border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const FILTER='h-10 border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50'; const LABEL='text-xs font-medium text-gray-600'; const INPUT='mt-1 block h-10 border border-gray-300 bg-white px-3 text-sm text-gray-900';
