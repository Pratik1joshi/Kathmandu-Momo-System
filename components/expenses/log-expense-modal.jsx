'use client';

import { useState, useEffect } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';

function authedRequest(url, options = {}) {
  const token = localStorage.getItem('pos_token');
  return fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
}

export const EXPENSE_CATEGORIES = [
  { value: 'salaries', label: 'Salaries & Payroll' },
  { value: 'infrastructure', label: 'Infrastructure & Assets' },
  { value: 'deposits', label: 'Deposits & Advances' },
  { value: 'utilities', label: 'Utilities & Operating' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card'];

export default function LogExpenseModal({ editingExpense, initialCategory, payrollMode = false, onClose, onSaved }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    description: editingExpense?.description || '',
    category: editingExpense?.category || initialCategory || (payrollMode ? 'salaries' : 'raw_materials'),
    amount: editingExpense?.amount ?? '',
    purchase_date: editingExpense?.purchase_date || new Date().toISOString().split('T')[0],
    payment_method: editingExpense?.payment_method || 'cash',
    supplier: editingExpense?.supplier || '',
    notes: editingExpense?.notes || '',
    receipt_url: editingExpense?.receipt_url || '',
  });
  // Managed expense categories (from the Expense Categories page), merged with
  // the built-in set so both the fixed vocabulary and custom ones are pickable.
  const [managedCats, setManagedCats] = useState([]);
  useEffect(() => {
    authedRequest('/api/admin/expense-categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setManagedCats(d.categories || []))
      .catch(() => {});
  }, []);
  const extraCats = managedCats
    .map((c) => c.name)
    .filter((n) => n && !EXPENSE_CATEGORIES.some((c) => c.value === n || c.label === n));

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await authedRequest('/api/uploads/receipts', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw data;
      setForm((f) => ({ ...f, receipt_url: data.url }));
    } catch (error) {
      addToast(friendlyFromError(error, 'upload_failed'));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) {
      addToast(friendlyMessage('validation', { description: 'Enter a title/description.' }));
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      addToast(friendlyMessage('validation', { description: 'Amount must be greater than zero.' }));
      return;
    }

    setSaving(true);
    try {
      const url = editingExpense ? '/api/admin/expenses' : '/api/admin/expenses';
      const method = editingExpense ? 'PUT' : 'POST';
      const res = await authedRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingExpense?.id, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      addToast(friendlyMessage('save_success', { description: 'Expense saved.' }));
      onSaved?.(data.expense);
      onClose();
    } catch (error) {
      addToast(friendlyFromError(error, 'save_failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{payrollMode ? 'Add Payroll / Salary' : editingExpense ? 'Edit Expense' : 'Log New Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {payrollMode ? 'Payroll Title (e.g. "October salary — Bikash")' : 'Expense Title'}
            </label>
            <input
              type="text"
              autoFocus
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
                {extraCats.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                step="any"
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                value={form.purchase_date}
                onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Payment Method</label>
              <select
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                value={form.payment_method}
                onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'bank_transfer' ? 'Bank Transfer' : m[0].toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {payrollMode ? 'Employee Name' : 'Paid To / Vendor Name'}
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes / Reference No</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Upload Receipt / Attachment (optional)</label>
            {form.receipt_url ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Paperclip className="h-4 w-4" />
                <a href={form.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Receipt attached
                </a>
                <button type="button" onClick={() => setForm((f) => ({ ...f, receipt_url: '' }))} className="text-gray-400 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} disabled={uploading} className="text-sm" />
            )}
            {uploading && <p className="mt-1 text-xs text-gray-400">Uploading…</p>}
          </div>
        </form>
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="button" disabled={saving || uploading} onClick={handleSubmit} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
