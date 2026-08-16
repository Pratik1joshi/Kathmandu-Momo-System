'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/admin-layout';
import { ArrowLeft, Phone, Mail, MapPin, CreditCard, Receipt, ShoppingBag, Loader2 } from 'lucide-react';
import { formatNepalDateTime } from '@/lib/report-dates.js';
import { formatCurrency } from '@/lib/currency';
import { orderTypeLabel } from '@/lib/order-types';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pos_token') : null;
  return { Authorization: `Bearer ${token}` };
}

function customersPath() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/cashier')
    ? '/cashier/customers'
    : '/admin/customers';
}

export default function CustomerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/customers/${id}/profile`, { headers: authHeaders() });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Failed to load profile');
      setData(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading customer…
        </div>
      </AdminLayout>
    );
  }

  if (error || !data?.customer) {
    return (
      <AdminLayout>
        <div className="p-8 text-center">
          <p className="text-red-600">{error || 'Customer not found'}</p>
          <button type="button" onClick={() => router.push(customersPath())} className="mt-4 text-sm text-blue-600 underline">
            Back to customers
          </button>
        </div>
      </AdminLayout>
    );
  }

  const { customer, summary, orders, bills, ledger, payments, outstanding_bills } = data;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push(customersPath())}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Customers
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {customer.name}
                {customer.is_vip ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">VIP</span> : null}
                {customer.is_blacklisted ? <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Blacklisted</span> : null}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Customer #{customer.id} · Since {formatNepalDateTime(customer.created_at)}</p>
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" />{customer.phone}</p>}
                {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" />{customer.email}</p>}
                {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" />{customer.address}</p>}
              </div>
              {customer.notes && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{customer.notes}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[280px]">
              <Stat label="Credit due" value={formatCurrency(summary.outstanding_credit)} tone={summary.outstanding_credit > 0 ? 'red' : 'green'} />
              <Stat label="Credit limit" value={formatCurrency(summary.credit_limit)} />
              <Stat label="Available" value={formatCurrency(summary.available_credit)} />
              <Stat label="Lifetime spent" value={formatCurrency(customer.total_spent)} />
              <Stat label="Visits" value={String(customer.total_visits || 0)} />
              <Stat label="Open invoices" value={String(summary.outstanding_invoices)} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {[
            { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag },
            { id: 'bills', label: `Bills (${bills.length})`, icon: Receipt },
            { id: 'ledger', label: 'Credit ledger', icon: CreditCard },
            { id: 'payments', label: `Payments (${payments.length})`, icon: CreditCard },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {tab === 'orders' && (
            <SimpleTable
              empty="No orders yet."
              headers={['Order', 'Type', 'Table', 'Total', 'Status', 'When (NPT)']}
              rows={orders.map((o) => [
                <Link key="n" href={`/admin/orders/${o.id}`} className="font-medium text-blue-700 hover:underline">{o.order_number}</Link>,
                orderTypeLabel(o),
                o.table_number || '—',
                formatCurrency(o.total),
                <span key="status" className="capitalize">{String(o.status || '').replace(/_/g, ' ')}</span>,
                formatNepalDateTime(o.created_at),
              ])}
            />
          )}
          {tab === 'bills' && (
            <>
              {outstanding_bills?.length > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {outstanding_bills.length} invoice(s) still have an outstanding balance.
                </p>
              )}
              <SimpleTable
                empty="No bills yet."
                headers={['Bill', 'Order', 'Total', 'Outstanding', 'Status', 'When (NPT)']}
                rows={bills.map((b) => [
                  <Link key="b" href={`/admin/bills`} className="font-medium text-blue-700 hover:underline">{b.bill_number}</Link>,
                  b.order_number || '—',
                  formatCurrency(b.grand_total),
                  formatCurrency(b.outstanding_amount || 0),
                  <span key="status" className="capitalize">{String(b.payment_status || b.status || '').replace(/_/g, ' ')}</span>,
                  formatNepalDateTime(b.created_at),
                ])}
              />
            </>
          )}
          {tab === 'ledger' && (
            <SimpleTable
              empty="No credit ledger entries."
              headers={['When (NPT)', 'Type', 'Invoice', 'Debit', 'Credit', 'Balance', 'Note']}
              rows={ledger.map((e) => [
                formatNepalDateTime(e.created_at),
                <span key="type" className="capitalize">{String(e.type || '').replace(/_/g, ' ')}</span>,
                e.invoice || '—',
                e.debit ? formatCurrency(e.debit) : '—',
                e.credit ? formatCurrency(e.credit) : '—',
                formatCurrency(e.running_balance),
                e.note || e.reference || '—',
              ])}
            />
          )}
          {tab === 'payments' && (
            <SimpleTable
              empty="No payments recorded."
              headers={['When (NPT)', 'Bill', 'Method', 'Amount', 'Reference']}
              rows={payments.map((p) => [
                formatNepalDateTime(p.created_at),
                p.bill_number || '—',
                <span key="method" className="capitalize">{p.method}{p.provider ? ` · ${p.provider}` : ''}</span>,
                formatCurrency(p.amount),
                p.reference || '—',
              ])}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, tone }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function SimpleTable({ headers, rows, empty }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-gray-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
          <tr>{headers.map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {cells.map((c, j) => <td key={j} className="px-2 py-2.5 text-gray-700">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
