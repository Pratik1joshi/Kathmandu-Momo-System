/**
 * Bill totals from dynamic settings (VAT + service charge).
 */

export function toPercent(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {number} subtotal
 * @param {{ discountAmount?: number, discountPercent?: number, vatPercent?: number, servicePercent?: number }} opts
 */
export function calculateBillTotals(subtotal, opts = {}) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const discountPercent = toPercent(opts.discountPercent, 0);
  const discountAmount =
    opts.discountAmount != null
      ? Math.max(0, Number(opts.discountAmount) || 0)
      : (sub * discountPercent) / 100;

  const afterDiscount = Math.max(0, sub - discountAmount);
  const vatPercent = toPercent(opts.vatPercent, 0);
  const servicePercent = toPercent(opts.servicePercent, 0);

  const tax = (afterDiscount * vatPercent) / 100;
  const serviceCharge = (afterDiscount * servicePercent) / 100;
  const total = afterDiscount + tax + serviceCharge;

  return {
    subtotal: sub,
    discount: discountAmount,
    afterDiscount,
    tax,
    taxPercent: vatPercent,
    serviceCharge,
    servicePercent,
    total,
  };
}

export function parseSettingsRates(settings = {}) {
  return {
    vatPercent: toPercent(
      settings.vat_percentage ?? settings.vatPercent ?? settings.vat,
      0
    ),
    servicePercent: toPercent(
      settings.service_charge_percentage ?? settings.servicePercent ?? settings.service_charge,
      0
    ),
  };
}
