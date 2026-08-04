'use client';

/**
 * Shared billing / payment screen — proforma print, discount, split payment,
 * complete payment, receipt print. Rendered by each role's own /bill/[id] page
 * so cashier AND admin bill in-module (no cross-role redirect). One payment API,
 * one receipt format; only `basePath` (where "back" and post-payment land) differs.
 *
 *   <BillPay orderId={id} basePath="/cashier" />
 *   <BillPay orderId={id} basePath="/admin" />
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CreditCard, Tag, Receipt, Printer, Check, AlertCircle,
} from 'lucide-react';
import MenuItemImage from '@/components/menu-item-image';
import { openReceiptPrint } from '@/lib/print-receipt';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';
import CustomerModePicker, {
  emptyCustomerSelection,
  validateCustomerSelection,
} from '@/components/billing/customer-mode-picker';
import BillConfirmModal from '@/components/billing/bill-confirm-modal';
import QrEnlargeModal from '@/components/billing/qr-enlarge-modal';
import { calculateBillTotals, parseSettingsRates } from '@/lib/billing-totals';

export default function BillPay({ orderId, basePath = '/cashier' }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customerSelection, setCustomerSelection] = useState(emptyCustomerSelection);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingBill, setPendingBill] = useState(null);
  const [splitPaymentMode, setSplitPaymentMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState([{ method: 'cash', amount: 0 }]);
  const [receiptData] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState({ image: '', title: '' });
  const [settings, setSettings] = useState({
    vat_percentage: 13, service_charge_percentage: 10, restaurant_name: 'Restaurant',
    restaurant_address: '', restaurant_phone: '', vat_number: '', pan_number: '',
    website: '', receipt_footer: '', receipt_paper_size: '80', bank_qr_image: '', esewa_qr_image: '',
  });

  useEffect(() => {
    fetchOrderDetails();
    fetchSettings();
    const onFocus = () => fetchSettings();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('pos_token');
      const response = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const s = data.settings || {};
        setSettings({
          ...s,
          vat_percentage: Number(s.vat_percentage ?? 13),
          service_charge_percentage: Number(s.service_charge_percentage ?? 10),
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchOrderDetails = async () => {
    try {
      const token = localStorage.getItem('pos_token');
      if (!token || token === 'null' || token === 'undefined') { router.push('/login'); return; }
      const orderRes = await fetch(`/api/restaurant/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (orderRes.ok) {
        const data = await orderRes.json();
        setOrder(data.order);
        setOrderItems(data.items || []);
        if (data.order?.customer_phone) {
          setCustomerSelection({
            mode: 'customer', phone: data.order.customer_phone, name: data.order.customer_name || '', address: '',
            customer: { id: data.order.customer_id || null, name: data.order.customer_name || '', phone: data.order.customer_phone },
            isNew: !data.order.customer_id,
          });
          if (data.order.customer_id || data.order.customer_phone) {
            try {
              const cRes = await fetch(`/api/admin/customers?phone=${encodeURIComponent(data.order.customer_phone)}`, { headers: { Authorization: `Bearer ${token}` } });
              if (cRes.ok) {
                const cData = await cRes.json();
                const found = cData.customer || cData.customers?.[0];
                if (found) {
                  setCustomerSelection({ mode: 'customer', phone: found.phone || data.order.customer_phone, name: found.name || data.order.customer_name || '', address: found.address || '', customer: found, isNew: false });
                }
              }
            } catch { /* keep order fallback */ }
          }
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order:', error);
      setLoading(false);
    }
  };

  const calculateBill = () => {
    const subtotal = order?.total_amount || 0;
    const { vatPercent, servicePercent } = parseSettingsRates(settings);
    const totals = calculateBillTotals(subtotal, { discountAmount: Math.max(0, discountAmount), vatPercent, servicePercent });
    return {
      subtotal: totals.subtotal, taxAmount: totals.tax, serviceCharge: totals.serviceCharge,
      discountAmount: totals.discount, finalAmount: totals.total, vatPercent: totals.taxPercent, servicePercent: totals.servicePercent,
    };
  };

  const addSplitPayment = () => setSplitPayments([...splitPayments, { method: 'cash', amount: 0 }]);
  const removeSplitPayment = (index) => { if (splitPayments.length > 1) setSplitPayments(splitPayments.filter((_, i) => i !== index)); };
  const updateSplitPayment = (index, field, value) => {
    const updated = [...splitPayments];
    updated[index][field] = field === 'amount' ? parseFloat(value) || 0 : value;
    setSplitPayments(updated);
  };
  const validateSplitPayments = () => {
    const total = splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const { finalAmount } = calculateBill();
    return Math.abs(total - finalAmount) < 0.01;
  };

  const openPaymentConfirm = () => {
    const token = localStorage.getItem('pos_token');
    if (!token || token === 'null' || token === 'undefined') { addToast(friendlyMessage('session_expired')); router.push('/login'); return; }
    const { finalAmount, subtotal, taxAmount, serviceCharge, discountAmount: disc, vatPercent, servicePercent } = calculateBill();
    if (finalAmount === 0 && !String(discountReason || '').trim()) { addToast(friendlyMessage('zero_reason_required')); return; }
    if (splitPaymentMode && !validateSplitPayments()) { addToast(friendlyMessage('payment_failed', { description: 'Split payment amounts must add up to the bill total.' })); return; }
    const customerCheck = validateCustomerSelection(customerSelection);
    if (!customerCheck.ok) { addToast(friendlyMessage('customer_required', { description: customerCheck.message })); return; }
    if (paymentMethod === 'credit' && customerSelection.mode !== 'customer') { addToast(friendlyMessage('customer_required', { description: 'Credit payments need a saved customer. Choose Customer and enter their phone.' })); return; }
    if (paymentMethod === 'credit' && finalAmount === 0) { addToast(friendlyMessage('payment_failed', { description: 'Credit cannot be used for a Rs 0 bill.' })); return; }
    setPendingBill({
      restaurant_name: settings.restaurant_name, restaurant_address: settings.restaurant_address,
      bill_number: `BILL-${Date.now()}`, order_number: order?.order_number, customer_mode: customerSelection.mode,
      customer_name: customerCheck.name, customer_phone: customerCheck.phone, customer_address: customerCheck.address || '',
      items: orderItems.filter((item) => !['voided', 'cancelled'].includes(item.status)).map((item) => ({ name: item.item_name || item.name, quantity: item.quantity, price: item.price, subtotal: item.subtotal ?? item.price * item.quantity })),
      subtotal, discount: disc, tax: taxAmount, tax_percent: vatPercent, service_charge: serviceCharge, service_percent: servicePercent,
      total: finalAmount, payment_method: splitPaymentMode ? 'split' : paymentMethod, amount_paid: finalAmount, change: 0,
      discount_reason: discountReason, zero_bill: finalAmount === 0, date: new Date().toLocaleString('en-NP', { timeZone: 'Asia/Kathmandu' }),
    });
    setConfirmOpen(true);
  };

  const processPayment = async () => {
    if (!pendingBill) return;
    try {
      setProcessing(true);
      const token = localStorage.getItem('pos_token');
      const { finalAmount } = calculateBill();
      const paymentData = {
        payment_method: splitPaymentMode ? 'split' : paymentMethod, amount_paid: finalAmount,
        discount_amount: discountAmount, discount_reason: discountReason, zero_reason: finalAmount === 0 ? discountReason : '',
        customer_mode: customerSelection.mode, customer_name: pendingBill.customer_name, customer_phone: pendingBill.customer_phone,
        customer_address: pendingBill.customer_address || '', split_payments: splitPaymentMode ? splitPayments : null,
      };
      const response = await fetch(`/api/restaurant/bills/${orderId}/payment`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(paymentData),
      });
      const data = await response.json();
      if (response.ok) {
        setConfirmOpen(false); setPendingBill(null); setProcessing(false);
        printThermalBill(data.receipt);
        addToast(friendlyMessage('payment_success', { description: data.customer?.created ? 'Payment received. New customer was saved.' : undefined }));
        router.push(basePath);
        return;
      }
      addToast(friendlyFromError(data, 'payment_failed'));
      setProcessing(false);
    } catch (error) {
      console.error('Payment error:', error);
      addToast(friendlyFromError(error, 'payment_failed'));
      setProcessing(false);
    }
  };

  const printThermalBill = (receipt, { proforma = false } = {}) => {
    const rows = (receipt.items || []).map((item) => `
      <tr><td class="c-name">${item.item_name}</td><td class="c-qty">${item.quantity}</td>
      <td class="c-price">Rs ${Number(item.unit_price).toFixed(2)}</td>
      <td class="c-total">Rs ${Number(item.subtotal).toFixed(2)}</td></tr>`).join('');
    const splitRows = receipt.split_payments
      ? receipt.split_payments.map((sp) => `<div class="r-row"><span>${sp.method.toUpperCase()}</span><span>Rs ${Number(sp.amount).toFixed(2)}</span></div>`).join('')
      : '';
    const body = `
      <div class="r-head">
        <div class="r-name">${settings.restaurant_name || 'RESTAURANT POS'}</div>
        ${settings.restaurant_address ? `<div class="r-sm">${settings.restaurant_address}</div>` : ''}
        ${settings.restaurant_phone ? `<div class="r-sm">Tel: ${settings.restaurant_phone}</div>` : ''}
        ${settings.vat_number ? `<div class="r-sm">VAT: ${settings.vat_number}</div>` : ''}
        ${settings.pan_number ? `<div class="r-sm">PAN: ${settings.pan_number}</div>` : ''}
        <div class="r-sm" style="margin-top:3px">${proforma ? 'PROFORMA — NOT PAID' : 'Tax Invoice'}</div>
      </div>
      <div class="r-info">
        <div><strong>Receipt No:</strong> #${receipt.order_id.toString().padStart(6, '0')}</div>
        <div><strong>Date:</strong> ${new Date(receipt.processed_at).toLocaleString('en-NP', { timeZone: 'Asia/Kathmandu' })}</div>
        <div><strong>Table:</strong> ${receipt.table_number}</div>
        <div><strong>Cashier:</strong> ${receipt.processed_by}</div>
        ${receipt.customer_name ? `<div><strong>Customer:</strong> ${receipt.customer_name}</div>` : ''}
        ${receipt.customer_phone ? `<div><strong>Phone:</strong> ${receipt.customer_phone}</div>` : ''}
      </div>
      <table>
        <thead><tr><th class="c-name">Item</th><th class="c-qty">Qty</th><th class="c-price">Price</th><th class="c-total">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="r-totals">
        <div class="r-row"><span>Subtotal</span><span>Rs ${receipt.subtotal.toFixed(2)}</span></div>
        <div class="r-row"><span>Tax (${receipt.tax_percent ?? settings.vat_percentage}%)</span><span>Rs ${receipt.tax_amount.toFixed(2)}</span></div>
        <div class="r-row"><span>Service (${receipt.service_charge_percent ?? settings.service_charge_percentage}%)</span><span>Rs ${receipt.service_charge.toFixed(2)}</span></div>
        ${receipt.discount_amount > 0 ? `<div class="r-row"><span>Discount</span><span>- Rs ${receipt.discount_amount.toFixed(2)}</span></div>` : ''}
        <div class="r-row r-grand"><span>GRAND TOTAL</span><span>Rs ${receipt.final_amount.toFixed(2)}</span></div>
      </div>
      ${proforma ? `
      <div class="r-info">
        <div class="r-row r-center" style="font-weight:bold">** NOT PAID **</div>
        <div class="r-sm r-center">Please pay at the counter.</div>
      </div>` : `
      <div class="r-info">
        <div class="r-row"><span><strong>Payment</strong></span><span>${receipt.payment_method.toUpperCase()}</span></div>
        ${splitRows}
        <div class="r-row"><span>Amount Paid</span><span>Rs ${receipt.amount_paid.toFixed(2)}</span></div>
        ${receipt.change > 0 ? `<div class="r-row"><span>Change</span><span>Rs ${receipt.change.toFixed(2)}</span></div>` : ''}
      </div>`}
      <div class="r-foot">
        <div>${settings.receipt_footer || 'Thank you for your visit!'}</div>
        ${settings.website ? `<div class="r-sm">${settings.website}</div>` : ''}
        ${settings.vat_number ? `<div style="margin-top:4px">VAT No: ${settings.vat_number}</div>` : ''}
        ${settings.pan_number ? `<div>PAN No: ${settings.pan_number}</div>` : ''}
      </div>`;
    openReceiptPrint({ title: `Bill ${receipt.order_id}`, size: settings.receipt_paper_size, body });
  };

  const printProforma = async () => {
    const b = calculateBill();
    const receipt = {
      order_id: order?.id, order_number: order?.order_number, table_number: order?.table_number,
      processed_by: '—', processed_at: new Date().toISOString(),
      items: orderItems.filter((i) => !['voided', 'cancelled'].includes(i.status)).map((i) => ({ item_name: i.item_name || i.name, quantity: i.quantity, unit_price: i.price, subtotal: i.subtotal ?? i.price * i.quantity })),
      subtotal: b.subtotal, tax_amount: b.taxAmount, tax_percent: b.vatPercent, service_charge: b.serviceCharge, service_charge_percent: b.servicePercent,
      discount_amount: b.discountAmount, final_amount: b.finalAmount, payment_method: '', amount_paid: 0, change: 0,
      customer_name: customerSelection?.name || '', customer_phone: customerSelection?.phone || '',
    };
    printThermalBill(receipt, { proforma: true });
    try {
      const token = localStorage.getItem('pos_token');
      await fetch(`/api/restaurant/orders/${orderId}/print-bill`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch { /* stamp is non-critical */ }
    addToast({ title: 'Bill printed', description: 'Order stays open until payment.' });
  };

  const formatCurrency = (amount) => `Rs ${amount?.toFixed(2) || '0.00'}`;

  const isOrderCompleted = order?.status === 'completed';
  const canProcessPayment = order && ['awaiting_payment', 'dining', 'served', 'ready', 'preparing', 'pending'].includes(order.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-800 text-lg">Loading bill details...</p>
        </div>
      </div>
    );
  }

  const bill = calculateBill();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <button onClick={() => router.push(basePath)} className="flex items-center space-x-2 text-gray-800 hover:text-gray-900 transition-colors self-start">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold"><span className="sm:hidden">Back</span><span className="hidden sm:inline">Back</span></span>
          </button>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">{isOrderCompleted ? 'Order Details' : 'Process Payment'}</h1>
        </div>

        {isOrderCompleted && (
          <div className="mb-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-xl p-4 sm:p-6">
            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-full flex-shrink-0"><Check className="w-6 h-6 sm:w-8 sm:h-8" /></div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold">Order Completed</h3>
                <p className="text-purple-100 text-sm sm:text-base">This order has already been paid and completed. You can only view the details.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-black mb-4 flex items-center"><Receipt className="w-6 h-6 mr-2 text-blue-600" />Order Details</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between"><span className="text-black">Order ID:</span><span className="font-bold text-black">#{order?.id.toString().padStart(4, '0')}</span></div>
                <div className="flex justify-between"><span className="text-black">Table:</span><span className="font-bold text-black">{order?.table_number}</span></div>
                <div className="flex justify-between"><span className="text-black">Status:</span><span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{order?.status}</span></div>
                <div className="flex justify-between"><span className="text-black">Time:</span><span className="font-semibold text-black">{new Date(order?.created_at).toLocaleString()}</span></div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-bold text-black mb-3">Items</h3>
                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 gap-3">
                      <MenuItemImage src={item.image_url} alt={item.item_name} size="sm" />
                      <div className="flex-1"><p className="font-semibold text-black">{item.item_name}</p><p className="text-sm text-black">Qty: {item.quantity} × {formatCurrency(item.price)}</p></div>
                      <span className="font-bold text-black">{formatCurrency(item.quantity * item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-4">Bill Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-lg"><span>Subtotal:</span><span className="font-semibold">{formatCurrency(bill.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-blue-100">Tax ({bill.vatPercent}%):</span><span>{formatCurrency(bill.taxAmount)}</span></div>
                {bill.servicePercent > 0 && (<div className="flex justify-between"><span className="text-blue-100">Service Charge ({bill.servicePercent}%):</span><span>{formatCurrency(bill.serviceCharge)}</span></div>)}
                {bill.discountAmount > 0 && (<div className="flex justify-between text-yellow-300"><span>Discount:</span><span>- {formatCurrency(bill.discountAmount)}</span></div>)}
                <div className="flex justify-between text-2xl font-bold pt-3 border-t-2 border-white/30"><span>Total:</span><span>{formatCurrency(bill.finalAmount)}</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isOrderCompleted ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><Check className="w-6 h-6 mr-2 text-green-600" />Payment Completed</h2>
                <div className="text-center py-12">
                  <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-12 h-12 text-green-600" /></div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">Payment Processed</p>
                  <p className="text-gray-600">This order has been completed and paid.</p>
                  <div className="mt-8 space-y-2"><button onClick={() => router.push(basePath)} className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold">Back</button></div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center"><CreditCard className="w-6 h-6 mr-2 text-blue-600" />Payment Details</h2>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 font-semibold">
                    <option value="cash">Cash</option>
                    <option value="qr">QR Payment (eSewa/Bank)</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit (Customer Account)</option>
                  </select>
                </div>

                {paymentMethod === 'qr' && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <h3 className="font-semibold text-gray-900 mb-4 text-center">Scan to Pay</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {settings.esewa_qr_image && (
                        <div className="text-center cursor-pointer" onClick={() => { setSelectedQR({ image: settings.esewa_qr_image, title: 'eSewa / Fonepay QR' }); setShowQRModal(true); }}>
                          <p className="text-sm font-semibold text-gray-900 mb-2">eSewa / Fonepay</p>
                          <img src={settings.esewa_qr_image} alt="eSewa QR" className="w-full max-w-[200px] mx-auto border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all" />
                          <p className="text-xs text-blue-600 mt-1">Click to enlarge</p>
                        </div>
                      )}
                      {settings.bank_qr_image && (
                        <div className="text-center cursor-pointer" onClick={() => { setSelectedQR({ image: settings.bank_qr_image, title: 'Bank QR Code' }); setShowQRModal(true); }}>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Bank QR</p>
                          <img src={settings.bank_qr_image} alt="Bank QR" className="w-full max-w-[200px] mx-auto border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all" />
                          <p className="text-xs text-blue-600 mt-1">Click to enlarge</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-6 p-4 bg-stone-50 rounded-lg border-2 border-stone-200">
                  <p className="text-sm font-bold text-stone-900 mb-3">Customer</p>
                  <CustomerModePicker value={customerSelection} onChange={setCustomerSelection} />
                </div>

                <div className="space-y-4 mb-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center"><Tag className="w-4 h-4 mr-2" />Discount Amount</label>
                    <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none text-gray-900" placeholder="0.00" min="0" step="0.01" />
                  </div>
                  {discountAmount > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Discount Reason</label>
                      <input type="text" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none text-gray-900" placeholder="e.g., Senior citizen, Promotional offer" required />
                    </div>
                  )}
                  {bill.finalAmount === 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Reason for Rs 0 bill</label>
                      <input type="text" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="w-full px-4 py-3 border-2 border-amber-400 rounded-lg focus:border-amber-500 focus:outline-none text-gray-900" placeholder="e.g., Guest left, mistaken order, complimentary" required />
                      <p className="text-xs text-amber-800 mt-1">Required to close empty or free bills and free the table.</p>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={splitPaymentMode} onChange={(e) => setSplitPaymentMode(e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" />
                    <span className="font-semibold text-gray-900">Split Payment</span>
                  </label>
                </div>

                {splitPaymentMode && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-gray-900">Split Payment Methods</label>
                      <button onClick={addSplitPayment} className="text-sm px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors font-semibold">+ Add Method</button>
                    </div>
                    {splitPayments.map((sp, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2">
                        <select value={sp.method} onChange={(e) => updateSplitPayment(index, 'method', e.target.value)} className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900">
                          <option value="cash">Cash</option><option value="online">Online</option><option value="card">Card</option><option value="credit">Credit</option>
                        </select>
                        <input type="number" value={sp.amount} onChange={(e) => updateSplitPayment(index, 'amount', e.target.value)} className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900" placeholder="Amount" min="0" step="0.01" />
                        {splitPayments.length > 1 && (<button onClick={() => removeSplitPayment(index)} className="px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">×</button>)}
                      </div>
                    ))}
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <div className="flex justify-between text-sm"><span>Split Total:</span><span className="font-bold">{formatCurrency(splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0))}</span></div>
                      <div className="flex justify-between text-sm mt-1"><span>Required:</span><span className="font-bold">{formatCurrency(bill.finalAmount)}</span></div>
                      {!validateSplitPayments() && (<p className="text-xs text-red-600 mt-2 flex items-center"><AlertCircle className="w-3 h-3 mr-1" />Split amounts must equal total</p>)}
                    </div>
                  </div>
                )}

                {canProcessPayment && (
                  <button type="button" onClick={printProforma} disabled={processing} className="w-full mb-3 py-3 bg-white border-2 border-blue-200 text-blue-700 rounded-xl font-semibold hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2">
                    <Printer className="w-5 h-5" />Print Bill (no payment)
                  </button>
                )}

                <button onClick={openPaymentConfirm} disabled={processing || (splitPaymentMode && !validateSplitPayments()) || !canProcessPayment} className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-bold text-lg shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                  <Check className="w-6 h-6" />
                  <span>{bill.finalAmount === 0 ? 'Complete Rs 0 bill' : `Complete Order - ${formatCurrency(bill.finalAmount)}`}</span>
                </button>

                {canProcessPayment && (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={async () => {
                      const empty = Number(order?.item_count || orderItems.filter((i) => !['voided', 'cancelled'].includes(i.status)).length) === 0;
                      const reason = window.prompt(empty ? 'Cancel empty order and release table? Enter a reason:' : 'Cancel this order and release the table? Enter a reason (admin/cashier only for orders with items):');
                      if (reason == null) return;
                      if (!String(reason).trim()) { addToast(friendlyMessage('validation', { description: 'A cancel reason is required.' })); return; }
                      try {
                        setProcessing(true);
                        const token = localStorage.getItem('pos_token');
                        const res = await fetch(`/api/restaurant/orders/${orderId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', cancel_reason: reason.trim() }) });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) { addToast(friendlyMessage('order_cancelled')); router.push(basePath); }
                        else addToast(friendlyFromError(data, 'save_failed'));
                      } catch (e) { addToast(friendlyFromError(e, 'save_failed')); }
                      finally { setProcessing(false); }
                    }}
                    className="w-full mt-2 py-3 bg-white border-2 border-red-200 text-red-700 rounded-xl font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancel order / release table
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <BillConfirmModal
        open={confirmOpen}
        bill={pendingBill}
        confirming={processing}
        onCancel={() => { if (processing) return; setConfirmOpen(false); setPendingBill(null); }}
        onPrint={() => pendingBill && printThermalBill({ ...pendingBill, order_id: order?.id, items: pendingBill.items, final_amount: pendingBill.total, tax_amount: pendingBill.tax, discount_amount: pendingBill.discount })}
        onConfirm={processPayment}
      />

      <QrEnlargeModal open={showQRModal} title={selectedQR.title} image={selectedQR.image} onClose={() => setShowQRModal(false)} />
    </div>
  );
}
