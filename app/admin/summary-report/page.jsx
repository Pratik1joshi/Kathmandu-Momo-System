'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Printer, RefreshCw } from 'lucide-react';
import { apiJson } from '@/lib/authed-fetch';
import { formatNepalDateTime, formatNepalDisplay, nepalDateString } from '@/lib/report-dates';

const money=(n)=>`Rs. ${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const line=(label,value,sign='')=>({label,value,sign});

export default function SummaryReportPage(){
  const today=nepalDateString();
  const [period,setPeriod]=useState('today'); const [from,setFrom]=useState(today); const [to,setTo]=useState(today);
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=useCallback(async(p=period)=>{setLoading(true);setError('');try{const query=p==='custom'?`period=custom&startDate=${from}&endDate=${to}`:`period=${p}`;setData(await apiJson(`/api/admin/summary-report?${query}`));}catch(e){setError(e.message||'Could not load report.');}finally{setLoading(false)}},[period,from,to]);
  useEffect(()=>{load()},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose=(p)=>{setPeriod(p);setTimeout(()=>load(p),0)};
  const d=data;
  return <AdminLayout>
    <header className="print:hidden border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">Summary Report</h1><p className="mt-1 text-sm text-gray-500">Financial and operational overview</p></div><div className="flex gap-2"><button onClick={()=>window.print()} className={BTN}><Printer className="h-4 w-4"/>Print</button><button onClick={()=>load()} disabled={loading} className={BTN}><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button></div></div>
      <div className="mt-5 flex flex-wrap items-end gap-2">{[['today','Today'],['this_week','This Week'],['this_month','This Month'],['year','This Year']].map(([p,l])=><button key={p} onClick={()=>choose(p)} className={`${FILTER} ${period===p?'bg-gray-900 text-white':'bg-white text-gray-700'}`}>{l}</button>)}<label className={LABEL}>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={INPUT}/></label><span className="pb-2 text-gray-400">-</span><label className={LABEL}>To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className={INPUT}/></label><button onClick={()=>{setPeriod('custom');load('custom')}} className={`${FILTER} bg-gray-900 text-white`}>Apply</button><button onClick={()=>{setFrom(today);setTo(today);choose('today')}} className={FILTER}>Reset</button></div>
    </header>
    <main className="bg-gray-50 p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
      {error&&<div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading&&!d?<div className="py-24 text-center text-sm text-gray-500">Building the report...</div>:d&&<div className="mx-auto max-w-7xl bg-white p-5 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-6 border-b-2 border-gray-900 pb-5"><p className="text-sm font-semibold text-gray-600">{d.restaurant_name}</p><h2 className="mt-1 text-3xl font-bold text-gray-950">Summary Report</h2><p className="mt-2 text-sm text-gray-600">{formatNepalDisplay(d.range.start)} - {formatNepalDisplay(d.range.end)}</p><p className="mt-1 text-xs text-gray-400">Generated {formatNepalDateTime(d.generated_at)} NPT</p></div>
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Section title="Restaurant Revenue" rows={[line('Cash Revenue',d.revenue.cash),line('Bank / Online Revenue',d.revenue.bank),line('Credit Revenue',d.revenue.credit),line('Total Revenue',d.revenue.total)]}/>
          <Section title="Customer Ledger Payments" rows={[line('Cash Received',d.ledger.cash),line('Bank Received',d.ledger.bank),line('Total Received',d.ledger.cash+d.ledger.bank)]}/>
          <Section title="Payment Received" rows={[line('Cash Received',d.received.cash),line('Bank Received',d.received.bank),line('Total Received',d.received.total)]}/>
          <Section title="Total Purchase" rows={[line('Cash',d.purchases.cash),line('Bank Transfer',d.purchases.bank),line('Credit Purchase',d.purchases.credit),line('Total Purchase',d.purchases.total)]}/>
          <Section title="Total Expense" rows={[line('Cash',d.expenses.cash),line('Bank Transfer',d.expenses.bank),line('Credit Expense',d.expenses.credit),line('Total Expense',d.expenses.total)]}/>
          <Section title="Total Salary Paid" rows={[line('Cash / bank paid now',d.salary.cash+d.salary.bank),line('Advance deductions',d.salary.advance_deductions),line('Gross salary expense',d.salary.total)]}/>
          <Section title="Cash Register" rows={[line('Cash In',d.cash_register.cash_in),line('Cash Out',d.cash_register.cash_out),line('Savings Deposit',d.cash_register.deposit)]}/>
          <Section title="Savings / Deposits" note="Transfers to savings are cash movements, not business expenses." rows={[line('From Cash',d.savings.cash),line('From Online / QR',d.savings.online),line('Total Saved',d.savings.total)]}/>
          <Section title="Profit & Loss" rows={[line('Revenue',d.profit.revenue),line('Estimated Food Cost',d.profit.food_cost,'-'),line('Estimated Gross Profit',d.profit.gross),line('Operating Expenses & Salary',d.profit.operating,'-'),line('Estimated Net Profit',d.profit.net,d.profit.net>=0?'+':'')]}/>
          <Account title="Cash in Hand" data={d.accounts.cash}/><Account title="Cash in Bank / Online" data={d.accounts.bank}/>
          <Section title="Exchange Cash" rows={[line('Cash In',d.exchange.cash.in),line('Cash Out',d.exchange.cash.out),line('Balance',d.exchange.cash.in-d.exchange.cash.out)]}/>
          <Section title="Exchange Online / Bank" rows={[line('Online In',d.exchange.bank.in),line('Online Out',d.exchange.bank.out),line('Balance',d.exchange.bank.in-d.exchange.bank.out)]}/>
          <Section title="Net Exchange" note="Positive means net income from exchange fees." rows={[line('Total Impact',d.exchange.net)]}/>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2"><Category title="Sale Category" rows={d.sale_categories}/><Category title="Purchase Category" rows={d.purchase_categories}/></div>
        <div className="mt-5 border border-gray-200"><h3 className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-900">Quantity Summary</h3><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">{Object.entries({ 'Sold Item Quantity':d.quantities.sold,'Purchase Quantity':d.quantities.purchased,Bills:d.quantities.bills,Orders:d.quantities.orders,KOTs:d.quantities.kots,'Expense Records':d.quantities.expenses,'Salary Records':d.quantities.salary,'Savings Records':d.quantities.savings}).map(([k,v])=><div key={k} className="border-b border-r border-gray-100 p-4"><p className="text-xs text-gray-500">{k}</p><p className="mt-1 text-xl font-bold text-gray-900">{Number(v||0).toLocaleString()}</p></div>)}</div></div>
      </div>}
    </main>
  </AdminLayout>
}

function Section({title,rows,note}){return <section className="border border-gray-200"><h3 className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900">{title}</h3><div className="divide-y divide-gray-100">{rows.map((r,i)=><div key={r.label} className={`flex justify-between gap-4 px-4 py-2.5 text-sm ${i===rows.length-1?'font-bold text-gray-950':'text-gray-600'}`}><span>{r.label}</span><span className="tabular-nums">{r.sign&&`${r.sign} `}{money(r.value)}</span></div>)}</div>{note&&<p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">{note}</p>}</section>}
function Account({title,data}){const m=data.movements||{};return <Section title={title} rows={[line('Opening Balance',data.opening),line('Opening Adjustment',m.drawer_open?.net||m.opening_cash_movement?.net||0),line('Sales & Collections',(m.bill?.net||0)+(m.bill_supplement?.net||0)+(m.credit_collection?.net||0),'+'),line('Purchases & Expenses',(m.purchase?.net||0)+(m.expense?.net||0)),line('Salary',m.payroll?.net||0),line('Savings',(m.savings_deposit?.net||0)),line('Money Exchange',m.exchange?.net||0),line(title.startsWith('Cash')?'Closing Cash':'Total in Bank',data.closing)]}/>}
function Category({title,rows}){return <section className="border border-gray-200"><h3 className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold">{title}</h3>{rows.length?<div className="divide-y divide-gray-100">{rows.map(r=><div key={r.category} className="flex justify-between px-4 py-3 text-sm"><div><p className="font-medium text-gray-900">{r.category}</p><p className="text-xs text-gray-500">Qty: {Number(r.quantity).toLocaleString()}</p></div><b>{money(r.amount)}</b></div>)}</div>:<p className="px-4 py-8 text-center text-sm text-gray-500">No {title.toLowerCase()} data</p>}</section>}
const BTN='inline-flex h-10 items-center gap-2 border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const FILTER='h-10 border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50'; const LABEL='text-xs font-medium text-gray-600'; const INPUT='mt-1 block h-10 border border-gray-300 bg-white px-3 text-sm text-gray-900';
