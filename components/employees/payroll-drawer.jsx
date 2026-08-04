'use client';

/**
 * Per-employee payroll: salary at a glance, a payment history, and a quick
 * "record payment" form. Reused from the Employees list (one row → this).
 */

import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';
import { apiJson } from '@/lib/authed-fetch';

const money = (n) => `Rs ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const METHODS = ['cash', 'bank', 'cheque', 'other'];

export default function PayrollDrawer({ employee, onClose }) {
  const { addToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: employee.salary ?? '',
    period_label: new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    paid_on: new Date().toISOString().slice(0, 10),
    method: 'cash',
    note: '',
  });

  const load = async () => {
    try {
      const data = await apiJson(`/api/admin/payroll?employee_id=${employee.id}`);
      setPayments(data.payments || []);
    } catch (error) {
      addToast(friendlyFromError(error, 'load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const record = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) >= 0) || form.amount === '') {
      addToast(friendlyMessage('validation', { description: 'Enter the amount paid.' }));
      return;
    }
    setSaving(true);
    try {
      await apiJson('/api/admin/payroll', {
        method: 'POST',
        body: JSON.stringify({ ...form, employee_id: employee.id, amount: Number(form.amount) }),
      });
      addToast(friendlyMessage('save_success', { description: 'Payment recorded.' }));
      setForm((f) => ({ ...f, note: '' }));
      load();
    } catch (error) {
      addToast(friendlyFromError(error, 'save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this payment record?')) return;
    try {
      await apiJson(`/api/admin/payroll?id=${id}`, { method: 'DELETE' });
      load();
    } catch (error) {
      addToast(friendlyFromError(error, 'delete_failed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Payroll</p>
            <h2 className="text-lg font-semibold text-gray-900">{employee.full_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Monthly salary" value={employee.salary != null ? money(employee.salary) : '—'} />
            <Stat label="Paid to date" value={money(totalPaid)} />
            <Stat label="Payments" value={String(payments.length)} />
          </div>

          <form onSubmit={record} className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Record a payment</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (Rs)">
                <input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Paid on">
                <input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Period">
                <input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} className={INPUT} placeholder="e.g. March 2026" />
              </Field>
              <Field label="Method">
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={INPUT}>
                  {METHODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Note">
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={INPUT} placeholder="Optional" />
            </Field>
            <button type="submit" disabled={saving} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {saving ? 'Saving…' : 'Record payment'}
            </button>
          </form>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Payment history</p>
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : payments.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{money(p.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.paid_on).toLocaleDateString()} · <span className="capitalize">{p.method}</span>
                        {p.period_label ? ` · ${p.period_label}` : ''}
                      </p>
                      {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                    </div>
                    <button type="button" onClick={() => remove(p.id)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

const INPUT = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-gray-900">{value}</p>
    </div>
  );
}
