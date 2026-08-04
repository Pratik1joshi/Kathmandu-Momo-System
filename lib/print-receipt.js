/**
 * Shared thermal-receipt print system. One place owns the @page / @media print
 * CSS so every receipt (cashier bill, walk-in, KOT) prints identically and can
 * switch between 80mm and 58mm printers from Settings — no per-page CSS.
 *
 * Callers build only the receipt <body> markup (using the class helpers below)
 * and hand it to openReceiptPrint({ size, body }).
 */

// body width is the printable area; thermal heads waste ~4-8mm of the paper.
export const RECEIPT_SIZES = {
  '58': { page: '58mm', body: '48mm', base: 8, name: 11, total: 9 },
  '80': { page: '80mm', body: '72mm', base: 9, name: 12, total: 10 },
};

export function normalizeSize(size) {
  const s = String(size || '80').replace('mm', '').trim();
  return RECEIPT_SIZES[s] ? s : '80';
}

/** The full <style> block for a given paper size. */
export function receiptStyle(size = '80') {
  const c = RECEIPT_SIZES[normalizeSize(size)];
  return `<style>
    @media print { @page { size: ${c.page} auto; margin: 0; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${c.body}; max-width: ${c.body}; margin: 0 auto; padding: 2mm;
      font-family: 'Courier New', monospace; font-size: ${c.base}px; line-height: 1.25; background: #fff; color: #000; }
    .r-center { text-align: center; }
    .r-name { font-size: ${c.name}px; font-weight: bold; }
    .r-sm { font-size: ${c.base - 1}px; }
    .r-hr { border-top: 1px dashed #000; margin: 3px 0; }
    .r-head { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px; }
    .r-info div { margin: 1px 0; font-size: ${c.base - 1}px; }
    table { width: 100%; border-collapse: collapse; margin: 3px 0; }
    th { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; text-align: left; font-size: ${c.base - 1}px; }
    td { padding: 1px 0; font-size: ${c.base - 1}px; vertical-align: top; }
    .c-name { width: 48%; } .c-qty { width: 14%; text-align: center; }
    .c-price { width: 19%; text-align: right; } .c-total { width: 19%; text-align: right; }
    .r-row { display: flex; justify-content: space-between; margin: 1px 0; font-size: ${c.base - 1}px; }
    .r-totals { border-top: 1px dashed #000; margin-top: 3px; padding-top: 2px; }
    .r-grand { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin: 3px 0;
      font-size: ${c.total}px; font-weight: bold; }
    .r-foot { text-align: center; border-top: 1px dashed #000; padding-top: 3px; margin-top: 4px; font-size: ${c.base - 1}px; }
    .r-qr { display: block; margin: 4px auto; width: ${c.body === '48mm' ? '30mm' : '40mm'}; max-width: 80%; }
  </style>`;
}

/**
 * Open a print window with the shared thermal CSS, write the body, auto-print
 * and close. `body` is receipt markup only (no <html>/<head>/<style>).
 */
export function openReceiptPrint({ title = 'Receipt', size = '80', body = '' }) {
  const w = window.open('', '', 'width=360,height=640');
  if (!w) return false;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>${receiptStyle(size)}</head><body>${body}
    <div style="height:8mm"></div>
    <script>
      var printed=false;
      window.onload=function(){ if(printed) return; printed=true; window.focus(); window.print();
        setTimeout(function(){ window.close(); }, 400); };
    </script></body></html>`);
  w.document.close();
  w.focus();
  return true;
}
