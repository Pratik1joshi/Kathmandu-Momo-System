'use client';

/**
 * Receive a delivery, or edit one that was already received.
 *
 * ── Which path converts ───────────────────────────────────────────────────
 * Nothing here converts. Quantities and unit costs are in PURCHASE units —
 * that is how a delivery note reads — and createPurchase() posts every line
 * with units:'purchase', so the ledger converts exactly once. The "adds N g"
 * hints below are display only; converting them into the payload as well
 * would multiply twice.
 *
 * A line's cost can be typed as a rate OR as the line total, whichever the
 * invoice shows; `cost_basis` records which one the user typed so the other
 * stays derived. Only the rate is ever sent.
 *
 * Editing reverses the previous receipt and re-applies the new one inside a
 * single transaction (lib/purchases.js), which is why the warning is worded
 * the way it is.
 */

import { useEffect, useMemo, useState } from 'react';
import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';
import { apiJson, authedRequest } from '@/lib/authed-fetch';
import { unitLabel } from '@/lib/units';
import { round } from '@/lib/entry-math';

const today = () => new Date().toISOString().split('T')[0];
const blankLine = () => ({
  inventory_item_id: '',
  quantity_ordered: '',
  quantity_received: '',
  unit_cost: '',
  line_total: '',
  cost_basis: 'unit',
});

export default function ReceiveDeliveryModal({ purchase, items, suppliers, employees, onClose, onSaved }) {
  const { addToast } = useToast();
  const editing = Boolean(purchase?.id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    supplier: purchase?.supplier || '',
    invoice_number: purchase?.invoice_number || '',
    invoice_date: purchase?.invoice_date?.slice(0, 10) || today(),
    expected_delivery_date: purchase?.expected_delivery_date?.slice(0, 10) || '',
    received_by: purchase?.received_by || '',
    payment_method: purchase?.payment_method || 'cash',
    tax: purchase?.tax ?? '',
    discount: purchase?.discount ?? '',
    shipping: purchase?.shipping ?? '',
    notes: purchase?.notes || '',
    attachment_url: purchase?.attachment_url || '',
  });
  const [lines, setLines] = useState(
    purchase?.items?.length
      ? purchase.items.map((l) => ({
          inventory_item_id: String(l.inventory_item_id || ''),
          quantity_ordered: String(l.quantity_ordered ?? ''),
          quantity_received: String(l.quantity_received ?? ''),
          unit_cost: String(l.unit_cost ?? ''),
          line_total: '',
          cost_basis: 'unit',
        }))
      : [blankLine()]
  );

  const itemById = useMemo(() => new Map(items.map((i) => [String(i.id), i])), [items]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const money = (v) => Number(v || 0) || 0;

  /** Received quantity for a line, defaulting to the ordered amount. */
  const receivedOf = (l) => (l.quantity_received === '' ? money(l.quantity_ordered) : money(l.quantity_received));

  /**
   * The rate, whether it was typed or has to be recovered from a typed total.
   * Returns null when a total was given but nothing was received — there is no
   * rate to derive, and 0 would silently wipe the item's moving average.
   */
  function rateOf(l) {
    if (l.cost_basis !== 'total') return money(l.unit_cost);
    const received = receivedOf(l);
    if (!(received > 0) || String(l.line_total).trim() === '') return null;
    return money(l.line_total) / received;
  }

  const totalOf = (l) => {
    const rate = rateOf(l);
    return rate === null ? money(l.line_total) : receivedOf(l) * rate;
  };

  const validLines = lines.filter((l) => l.inventory_item_id && Number(l.quantity_ordered || l.quantity_received) > 0);
  const subtotal = validLines.reduce((s, l) => s + totalOf(l), 0);
  const total = subtotal + money(form.tax) + money(form.shipping) - money(form.discount);
  const isPartial = validLines.some(
    (l) => l.quantity_received !== '' && money(l.quantity_received) < money(l.quantity_ordered)
  );

  useEffect(() => {
    // Default the receiver to the logged-in user on a fresh delivery.
    if (editing || form.received_by) return;
    try {
      const me = JSON.parse(localStorage.getItem('pos_user') || '{}');
      if (me?.id) set({ received_by: me.id });
    } catch {
      /* no stored user — the field stays optional */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLine(index, patch) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function uploadInvoice(file) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await authedRequest('/api/uploads/receipts', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw data;
      set({ attachment_url: data.url });
    } catch (error) {
      addToast(friendlyFromError(error, 'upload_failed'));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!validLines.length) {
      addToast(friendlyMessage('validation', { description: 'Add at least one delivered item with a quantity.' }));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        received_by: form.received_by || null,
        expected_delivery_date: form.expected_delivery_date || null,
        tax: money(form.tax),
        discount: money(form.discount),
        shipping: money(form.shipping),
        // PURCHASE units and a per-purchase-unit rate, unconverted —
        // createPurchase posts these with units:'purchase'.
        items: validLines.map((l) => ({
          inventory_item_id: Number(l.inventory_item_id),
          quantity_ordered: money(l.quantity_ordered),
          quantity_received: receivedOf(l),
          unit_cost: round(rateOf(l) ?? 0, 6),
        })),
      };
      const data = editing
        ? await apiJson(`/api/admin/purchases/${purchase.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiJson('/api/admin/purchases', { method: 'POST', body: JSON.stringify(payload) });

      (data.purchase?.stock?.warnings || []).forEach((w) =>
        addToast(friendlyMessage('validation', { description: w }))
      );
      addToast(
        friendlyMessage('save_success', {
          description: editing
            ? 'Purchase updated — the old receipt was reversed and the new one applied.'
            : `Stock updated and an expense of Rs ${total.toFixed(2)} posted.`,
        })
      );
      onSaved?.();
      onClose();
    } catch (error) {
      addToast(friendlyFromError(error, 'save_failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit purchase #${purchase.id}` : 'Receive delivery'}</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {editing && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Saving reverses the stock this purchase originally added, then applies the new lines and rewrites the linked
              expense. Both happen together or not at all.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Supplier">
              <input
                list="delivery-suppliers"
                value={form.supplier}
                onChange={(e) => set({ supplier: e.target.value })}
                className={INPUT}
                placeholder="Pick one, or type a new name"
              />
              <datalist id="delivery-suppliers">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
              <span className="mt-1 block text-xs text-gray-400">A name that does not exist yet is created for you.</span>
            </Field>
            <Field label="Invoice number">
              <input value={form.invoice_number} onChange={(e) => set({ invoice_number: e.target.value })} className={INPUT} placeholder="Optional" />
            </Field>
            <Field label="Invoice date">
              <input type="date" value={form.invoice_date} onChange={(e) => set({ invoice_date: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Expected delivery date">
              <input
                type="date"
                value={form.expected_delivery_date}
                onChange={(e) => set({ expected_delivery_date: e.target.value })}
                className={INPUT}
              />
            </Field>
            <Field label="Received by">
              <select value={form.received_by} onChange={(e) => set({ received_by: e.target.value })} className={INPUT}>
                <option value="">Not recorded</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name || emp.username}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment">
              <select value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value })} className={INPUT}>
                <option value="cash">Paid — Cash</option>
                <option value="bank_transfer">Paid — Bank</option>
                <option value="credit">On credit (payable)</option>
              </select>
              <span className="mt-1 block text-xs text-gray-400">&quot;On credit&quot; books this to Accounts Payable for the supplier.</span>
            </Field>
            <Field label="Invoice attachment">
              {form.attachment_url ? (
                <span className="flex h-10 items-center gap-2 text-sm text-gray-600">
                  <Paperclip className="h-4 w-4" />
                  <a href={form.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    Attached
                  </a>
                  <button type="button" onClick={() => set({ attachment_url: '' })} className="text-gray-400 hover:text-red-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => uploadInvoice(e.target.files?.[0])} disabled={uploading} className="h-10 w-full text-sm" />
              )}
            </Field>
          </div>

          <div className="rounded-xl border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Delivered items</p>
                <p className="text-xs text-gray-500">
                  Quantities and costs are in purchase units. Type either the unit cost or the line total — the other
                  fills itself in.
                </p>
              </div>
              <button type="button" onClick={() => setLines((p) => [...p, blankLine()])} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Plus className="h-3.5 w-3.5" /> Add line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Ordered</th>
                    <th className="px-3 py-2 font-semibold">Received</th>
                    <th className="px-3 py-2 font-semibold">Unit cost</th>
                    <th className="px-3 py-2 text-right font-semibold">Line total</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, i) => {
                    const item = itemById.get(line.inventory_item_id);
                    const received = receivedOf(line);
                    const factor = Number(item?.conversion_factor) > 0 ? Number(item.conversion_factor) : 1;
                    const short = line.quantity_received !== '' && money(line.quantity_received) < money(line.quantity_ordered);
                    const rate = rateOf(line);
                    const byTotal = line.cost_basis === 'total';
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <select
                            value={line.inventory_item_id}
                            onChange={(e) => updateLine(i, { inventory_item_id: e.target.value })}
                            className="h-9 w-56 rounded-md border border-gray-300 px-2 text-sm"
                          >
                            <option value="">Select item…</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.item_name} ({it.purchase_unit || it.unit})
                              </option>
                            ))}
                          </select>
                          {item && received > 0 && (
                            <p className="mt-1 text-xs text-gray-400">
                              {received} {unitLabel(item.purchase_unit || item.unit)} = {round(received * factor)}{' '}
                              {unitLabel(item.consumption_unit || item.unit)} added to stock
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="any" value={line.quantity_ordered} onChange={(e) => updateLine(i, { quantity_ordered: e.target.value })} className="h-9 w-24 rounded-md border border-gray-300 px-2 text-sm" />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            value={line.quantity_received}
                            onChange={(e) => updateLine(i, { quantity_received: e.target.value })}
                            placeholder="all"
                            className={`h-9 w-24 rounded-md border px-2 text-sm ${short ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            value={byTotal ? (rate === null ? '' : round(rate, 4)) : line.unit_cost}
                            onChange={(e) => updateLine(i, { unit_cost: e.target.value, cost_basis: 'unit' })}
                            placeholder="0"
                            className={`h-9 w-28 rounded-md border px-2 text-sm ${byTotal ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-300'}`}
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            per {unitLabel(item?.purchase_unit || item?.unit) || 'unit'}
                            {byTotal ? ' · calculated' : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          {/* Type whichever end the invoice shows; the other is derived. */}
                          <input
                            type="number"
                            step="any"
                            value={byTotal ? line.line_total : received > 0 && line.unit_cost !== '' ? round(totalOf(line), 2) : ''}
                            onChange={(e) => updateLine(i, { line_total: e.target.value, cost_basis: 'total' })}
                            placeholder="0"
                            className={`h-9 w-28 rounded-md border px-2 text-right text-sm tabular-nums ${
                              byTotal ? 'border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-500'
                            }`}
                          />
                          {byTotal && rate === null && (
                            <p className="mt-1 text-xs text-amber-700">Enter a quantity first.</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {lines.length > 1 && (
                            <button type="button" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tax">
                <input type="number" step="any" value={form.tax} onChange={(e) => set({ tax: e.target.value })} className={INPUT} placeholder="0" />
              </Field>
              <Field label="Discount">
                <input type="number" step="any" value={form.discount} onChange={(e) => set({ discount: e.target.value })} className={INPUT} placeholder="0" />
              </Field>
              <Field label="Shipping">
                <input type="number" step="any" value={form.shipping} onChange={(e) => set({ shipping: e.target.value })} className={INPUT} placeholder="0" />
              </Field>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <Row label="Subtotal" value={subtotal} />
              <Row label="Tax" value={money(form.tax)} />
              <Row label="Shipping" value={money(form.shipping)} />
              <Row label="Discount" value={-money(form.discount)} />
              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-semibold tabular-nums text-gray-900">Rs {total.toFixed(2)}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {isPartial ? 'Saved as a partial delivery — the outstanding quantity stays visible on the purchase.' : 'Saved as fully received.'}{' '}
                An expense of Rs {total.toFixed(2)} is created and linked to this purchase.
              </p>
            </div>
          </div>

          <Field label="Notes">
            <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </Field>
        </div>

        <DialogFooter>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700">
            Cancel
          </button>
          <button type="button" disabled={saving || uploading} onClick={submit} className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Receive & update stock'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-gray-600">
      <span>{label}</span>
      <span className="tabular-nums">Rs {Number(value).toFixed(2)}</span>
    </div>
  );
}
