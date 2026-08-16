'use client';

import { useEffect, useState } from 'react';

// Native <input type="date"> renders in whatever format the OS/browser locale
// uses (usually mm/dd/yyyy on US-locale Windows) — the page's `lang` attribute
// does NOT override it in Chromium/Firefox, verified empirically. This is a
// plain masked text input instead, so the displayed format is fully ours.

function isoToDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function displayToIso(display) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return `${y}-${mo}-${d}`;
}

// Auto-insert slashes as digits are typed: 16082026 -> 16/08/2026
function maskInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `/${digits.slice(4, 8)}`;
  return out;
}

/**
 * Controlled dd/mm/yyyy date input. `value`/`onChange` are ISO yyyy-mm-dd
 * strings, same contract as the native `<input type="date">` it replaces.
 * Optional `min`/`max` (ISO strings) reject an out-of-range typed date the
 * same way a native date input would clamp/refuse one.
 */
export default function DateInput({ value, onChange, min, max, className = '', 'aria-label': ariaLabel, placeholder = 'dd/mm/yyyy', ...rest }) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const masked = maskInput(e.target.value);
    setDisplay(masked);
    if (masked === '') { onChange(''); return; }
    const iso = displayToIso(masked);
    if (!iso) return;
    if (min && iso < min) return;
    if (max && iso > max) return;
    onChange(iso);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={10}
      aria-label={ariaLabel}
      className={className}
      {...rest}
    />
  );
}
