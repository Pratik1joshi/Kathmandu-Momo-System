'use client';

import { useEffect, useRef, useState } from 'react';
import { User, UserRound, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Walk-in vs Customer picker with phone lookup + new-customer fields.
 * @param {'full'|'toggle'|'details'} section - split so billing cart can keep item space
 */
export default function CustomerModePicker({
  value,
  onChange,
  compact = false,
  section = 'full',
  hideWalkIn = false,
}) {
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const debounceRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const mode = value?.mode || 'walkin';
  const phone = value?.phone || '';
  const name = value?.name || '';
  const address = value?.address || '';
  const customer = value?.customer || null;
  const isNew = !!value?.isNew;

  const patch = (partial) => {
    onChangeRef.current({ ...valueRef.current, ...partial });
  };

  useEffect(() => {
    if (mode !== 'customer') {
      setLookupDone(false);
      return;
    }

    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10) {
      setLookupDone(false);
      if (valueRef.current?.customer || valueRef.current?.isNew) {
        patch({ customer: null, isNew: false, name: '', address: '' });
      }
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const token = localStorage.getItem('pos_token');
        const res = await fetch(`/api/admin/customers?phone=${encodeURIComponent(digits)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('lookup failed');
        const data = await res.json();
        const found =
          data.customer ||
          (data.customers || []).find(
            (c) => String(c.phone || '').replace(/\D/g, '') === digits
          );

        if (found) {
          patch({
            customer: found,
            isNew: false,
            name: found.name || '',
            address: found.address || '',
          });
        } else {
          const prev = valueRef.current || {};
          patch({
            customer: null,
            isNew: true,
            name: prev.customer ? '' : prev.name || '',
            address: prev.customer ? '' : prev.address || '',
          });
        }
        setLookupDone(true);
      } catch {
        patch({ customer: null, isNew: true });
        setLookupDone(true);
      } finally {
        setLookingUp(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [phone, mode]);

  const showToggle = (section === 'full' || section === 'toggle') && !hideWalkIn;
  const showDetails =
    (section === 'full' || section === 'details') &&
    (mode === 'customer' || hideWalkIn);

  const btnPad = compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {showToggle && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() =>
              onChange({
                mode: 'walkin',
                phone: '',
                name: 'Walk-in Customer',
                address: '',
                customer: null,
                isNew: false,
              })
            }
            className={`flex items-center justify-center gap-1.5 rounded-lg border-2 font-semibold transition-colors ${btnPad} ${
              mode === 'walkin'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
            }`}
          >
            <UserRound className="w-3.5 h-3.5" />
            Walk-in
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                mode: 'customer',
                phone: '',
                name: '',
                address: '',
                customer: null,
                isNew: false,
              })
            }
            className={`flex items-center justify-center gap-1.5 rounded-lg border-2 font-semibold transition-colors ${btnPad} ${
              mode === 'customer'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Customer
          </button>
        </div>
      )}

      {showDetails && (
        <div className={`space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 ${compact ? 'p-2' : 'p-3'}`}>
          <div>
            <label className="block text-[11px] font-bold text-stone-800 mb-0.5">Phone *</label>
            <div className="relative">
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => patch({ phone: e.target.value.replace(/\D/g, '') })}
                placeholder="98XXXXXXXX"
                className="w-full px-2.5 py-1.5 border border-stone-200 rounded-md text-stone-900 font-medium text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {lookingUp && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-stone-400" />
              )}
            </div>
            {phone && phone.replace(/\D/g, '').length > 0 && phone.replace(/\D/g, '').length < 10 && (
              <p className="mt-0.5 text-[11px] font-medium text-amber-700">Need at least 10 digits</p>
            )}
          </div>

          {customer && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-900 truncate">
                {customer.name}
                <span className="font-medium text-emerald-700"> · {customer.phone}</span>
              </p>
            </div>
          )}

          {isNew && lookupDone && !lookingUp && phone.replace(/\D/g, '').length >= 10 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-amber-800">New customer</p>
              <input
                type="text"
                value={name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Name *"
                className="w-full px-2.5 py-1.5 border border-stone-200 rounded-md text-stone-900 text-sm"
              />
              <input
                type="text"
                value={address}
                onChange={(e) => patch({ address: e.target.value })}
                placeholder="Address (optional)"
                className="w-full px-2.5 py-1.5 border border-stone-200 rounded-md text-stone-900 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function validateCustomerSelection(value) {
  if (!value || value.mode === 'walkin') {
    return { ok: true, name: 'Walk-in Customer', phone: null };
  }
  const digits = String(value.phone || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return { ok: false, message: 'Please enter a valid 10-digit phone number.' };
  }
  if (value.customer) {
    return {
      ok: true,
      name: value.customer.name,
      phone: value.customer.phone || digits,
      customer_id: value.customer.id,
    };
  }
  if (!String(value.name || '').trim()) {
    return { ok: false, message: 'Please enter the customer name.' };
  }
  return {
    ok: true,
    name: value.name.trim(),
    phone: digits,
    address: value.address?.trim() || '',
    isNew: true,
  };
}

export const emptyCustomerSelection = {
  mode: 'walkin',
  phone: '',
  name: 'Walk-in Customer',
  address: '',
  customer: null,
  isNew: false,
};
