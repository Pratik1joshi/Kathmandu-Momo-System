'use client'

/**
 * Shared POS order manager — the live order: items, void, add-more, serve,
 * send-to-cashier, and (for roles that bill) take payment. Rendered by each
 * role's own /order/[id] page; `basePath` keeps navigation inside the module.
 *
 *   <OrderManager orderId={id} basePath="/cashier" canPay />
 *
 * `canPay` shows "Take Payment" → `${basePath}/bill/${id}` (in-module billing).
 * Waiters omit it and use "Ready for Payment" to hand off to the cashier.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Send, CreditCard, Check, Star, Users, Unlock, X, Banknote } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import {
  ORDER_STATUS_UI,
  TABLE_STATUS_UI,
  formatElapsed,
  normalizeOrderStatus,
  canAddItems,
  canRequestPayment,
  canCashierBill,
} from '@/lib/restaurant-status'
import { formatNepalClock } from '@/lib/time-utils'
import { usePermissions } from '@/lib/use-permissions'

export default function OrderManager({ orderId, basePath = '/waiter', homePath = basePath, canPay = false }) {
  const { apiCall, loading: authLoading, token } = useAuth()
  const { can } = usePermissions()
  const router = useRouter()
  const { addToast } = useToast()

  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [reservation, setReservation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const [voidItem, setVoidItem] = useState(null)

  const home = homePath

  const load = async () => {
    try {
      const res = await apiCall(`/api/restaurant/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
        setItems(data.items || [])
        setReservation(data.reservation || null)
      } else {
        addToast(friendlyMessage('load_failed'))
      }
    } catch (e) {
      addToast(friendlyFromError(e, 'load_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    const hasToken = token || (typeof window !== 'undefined' && localStorage.getItem('pos_token'))
    if (!hasToken) {
      router.push('/login')
      return
    }
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, authLoading, token])

  const setStatus = async (status, okMsg, extra = {}) => {
    setBusy(true)
    try {
      const res = await apiCall(`/api/restaurant/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        addToast(friendlyMessage('save_success', { description: okMsg }))
        setConfirmPay(false)
        setConfirmUnlock(false)
        await load()
        if (status === 'cancelled') router.push(home)
      } else {
        addToast(friendlyFromError(data, 'save_failed'))
      }
    } catch (e) {
      addToast(friendlyFromError(e, 'save_failed'))
    } finally {
      setBusy(false)
    }
  }

  const cancelOrder = async () => {
    const reason =
      activeCount === 0 ? 'Empty order released' : window.prompt('Cancel reason (required):')
    if (activeCount > 0 && reason == null) return
    if (activeCount > 0 && !String(reason || '').trim()) {
      addToast(friendlyMessage('validation', { description: 'A cancel reason is required.' }))
      return
    }
    setBusy(true)
    try {
      const res = await apiCall(`/api/restaurant/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancel_reason: String(reason || 'Empty order released').trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        addToast(friendlyMessage('order_cancelled'))
        setConfirmCancel(false)
        router.push(home)
      } else {
        addToast(friendlyFromError(data, 'save_failed'))
      }
    } catch (e) {
      addToast(friendlyFromError(e, 'save_failed'))
    } finally {
      setBusy(false)
    }
  }

  const voidLine = async () => {
    if (!voidItem) return
    const reason = window.prompt('Void reason (required):')
    if (reason == null) { setVoidItem(null); return }
    if (!String(reason).trim()) {
      addToast(friendlyMessage('validation', { description: 'A void reason is required.' }))
      return
    }
    setBusy(true)
    try {
      const res = await apiCall(`/api/restaurant/orders/${orderId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: voidItem.item_id || voidItem.id, reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        addToast(friendlyMessage('item_voided'))
        setVoidItem(null)
        setItems(data.items || [])
        setOrder(data.order || order)
      } else {
        addToast(friendlyFromError(data, 'save_failed'))
      }
    } catch (e) {
      addToast(friendlyFromError(e, 'save_failed'))
    } finally {
      setBusy(false)
    }
  }

  if (loading || !order) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading order…</div>
  }

  const status = normalizeOrderStatus(order.status)
  const statusUi = ORDER_STATUS_UI[status] || ORDER_STATUS_UI.pending
  const tableUi = TABLE_STATUS_UI[status === 'preparing' ? 'cooking' : status] || TABLE_STATUS_UI.occupied
  const activeItems = items.filter((i) => !['voided', 'cancelled'].includes(i.status))
  const activeCount = activeItems.length
  const total = activeItems.reduce((s, i) => s + Number(i.subtotal ?? i.price * i.quantity), 0)
  const allowAdd = canAddItems(status)
  const allowServe = status === 'ready'
  const allowRequestPay = canRequestPayment(status)
  const billable = canPay && can('complete_payments') && canCashierBill(status)
  const canCancelEmpty = !['completed', 'cancelled'].includes(status) && activeCount === 0
  const canUnlock = status === 'awaiting_payment'

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => router.push(home)} className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{order.table_number ? `Table ${order.table_number}` : 'Takeaway'}</h1>
            <p className="text-xs text-slate-500 truncate">{order.order_number} · {formatElapsed(order.created_at)} · {formatNepalClock(order.created_at)}</p>
          </div>
          <button type="button" onClick={load} className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-slate-700" />
          </button>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusUi.badge}`}>{statusUi.label}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {reservation && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Reservation guest</p>
                <p className="font-semibold text-violet-950 truncate">
                  {reservation.is_vip ? <Star className="w-3.5 h-3.5 inline text-amber-500 mr-0.5" /> : null}
                  {reservation.name}
                </p>
                <p className="text-xs text-violet-800 mt-0.5 flex flex-wrap gap-x-2">
                  <span className="inline-flex items-center gap-0.5"><Users className="w-3 h-3" />{reservation.party_size || reservation.guests}</span>
                  <span>{reservation.time || '—'}{reservation.date ? ` · ${reservation.date}` : ''}</span>
                </p>
              </div>
              {reservation.occasion && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-violet-800 border border-violet-200">{reservation.occasion}</span>
              )}
            </div>
            {(reservation.message || reservation.admin_notes) && (
              <p className="text-[11px] text-violet-900/80 mt-1.5 line-clamp-2">{[reservation.message, reservation.admin_notes].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        )}

        {status === 'awaiting_payment' && (
          <div className={`rounded-2xl border p-4 ${tableUi.soft}`}>
            <p className="font-semibold text-amber-900">Awaiting payment</p>
            <p className="text-sm text-amber-800 mt-1">Ordering is locked. {canPay ? 'Take payment below, or unlock if guests want more.' : 'Unlock below if guests need more food, or wait for cashier checkout.'}</p>
          </div>
        )}

        {canCancelEmpty && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-900">Empty order</p>
            <p className="text-sm text-red-800 mt-1">No items yet. Cancel to free the table if guests left or this was opened by mistake.</p>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
            <h2 className="font-semibold text-slate-900">Order items</h2>
            <span className="text-sm text-slate-500">{activeCount} lines</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const voided = ['voided', 'cancelled'].includes(item.status)
              const canVoid = !voided && allowAdd && (item.status || 'pending') === 'pending'
              return (
                <div key={item.item_id || item.id} className={`px-4 py-3 flex gap-3 ${voided ? 'opacity-50' : ''}`}>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">{item.quantity}×</div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-slate-900 ${voided ? 'line-through' : ''}`}>{item.item_name}</p>
                    {item.special_instructions && <p className="text-xs text-amber-700 mt-0.5">Note: {item.special_instructions}</p>}
                    <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{item.status || 'pending'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="font-semibold text-slate-900 text-sm">Rs {Number(item.subtotal ?? item.price * item.quantity).toFixed(0)}</p>
                    {canVoid && (
                      <button type="button" disabled={busy} onClick={() => setVoidItem(item)} className="text-[11px] font-semibold text-red-600">Void</button>
                    )}
                  </div>
                </div>
              )
            })}
            {items.length === 0 && <p className="px-4 py-10 text-center text-slate-500">No items yet</p>}
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Running total</span>
            <span className="text-xl font-bold text-slate-900">Rs {total.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto space-y-2">
          {allowAdd && (
            <button type="button" onClick={() => router.push(`${basePath}/new-order?order=${orderId}`)} className="w-full h-12 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Add more items
            </button>
          )}
          {/* Roles that bill get a direct in-module payment action. */}
          {billable && (
            <button type="button" onClick={() => router.push(`${basePath}/bill/${orderId}`)} className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2">
              <Banknote className="w-5 h-5" />
              Take Payment
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {allowServe && (
              <button type="button" disabled={busy} onClick={() => setStatus('dining', 'Food served. Table stays dining — guests can order more.')} className="h-12 rounded-2xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <Check className="w-5 h-5" />
                Serve
              </button>
            )}
            {!canPay && allowRequestPay && (
              <button type="button" disabled={busy} onClick={() => setConfirmPay(true)} className={`h-12 rounded-2xl bg-amber-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${allowServe ? '' : 'col-span-2'}`}>
                <CreditCard className="w-5 h-5" />
                Ready for Payment
              </button>
            )}
            {canUnlock && (
              <button type="button" disabled={busy} onClick={() => setConfirmUnlock(true)} className="col-span-2 h-12 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <Unlock className="w-5 h-5" />
                Unlock ordering
              </button>
            )}
            {canCancelEmpty && (
              <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)} className="col-span-2 h-11 rounded-2xl border border-red-200 bg-red-50 text-red-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <X className="w-4 h-4" />
                Cancel empty order / release table
              </button>
            )}
            {!canPay && !allowServe && !allowRequestPay && status === 'awaiting_payment' && (
              <p className="col-span-2 text-center text-sm text-slate-500 py-1">Waiting for cashier — or unlock above to add items</p>
            )}
            {(status === 'pending' || status === 'preparing') && activeCount > 0 && (
              <p className="col-span-2 text-center text-sm text-slate-500 py-1 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Kitchen is working on this order
              </p>
            )}
          </div>
        </div>
      </div>

      {confirmPay && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900">Send to cashier?</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">Table will move to <strong>Awaiting Payment</strong>. Guests cannot order more until checkout finishes. Cashier will see this bill immediately.</p>
            </div>
            <div className="p-4 pt-0 flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" onClick={() => setConfirmPay(false)} className="flex-1 h-11 rounded-xl bg-slate-100 font-semibold text-slate-800">Back</button>
              <button type="button" disabled={busy} onClick={() => setStatus('awaiting_payment', 'Bill sent to cashier. Table awaiting payment.')} className="flex-1 h-11 rounded-xl bg-amber-500 text-white font-semibold disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={canCancelEmpty ? 'Cancel empty order?' : 'Cancel this order?'}
        description={canCancelEmpty ? 'This frees the table and cancels any linked reservation seating. Use this when guests left or the order was opened by mistake.' : 'Waiters can only cancel empty orders. Orders with kitchen items need a cashier or admin.'}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        variant="danger"
        busy={busy}
        onConfirm={cancelOrder}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmUnlock}
        title="Unlock ordering?"
        description="Return this table to Dining so guests can add more items. Cashier will no longer see it as ready for payment until you send the bill again."
        confirmLabel="Unlock"
        cancelLabel="Keep locked"
        variant="warning"
        busy={busy}
        icon={Unlock}
        onConfirm={() => setStatus('dining', 'Ordering unlocked. Guests can add more items.', { unlock_bill: true })}
        onCancel={() => setConfirmUnlock(false)}
      />

      <ConfirmDialog
        open={!!voidItem}
        title="Void this item?"
        description={voidItem ? `Remove ${voidItem.item_name} from the bill and restore stock.` : ''}
        confirmLabel="Void item"
        cancelLabel="Keep item"
        variant="danger"
        busy={busy}
        onConfirm={voidLine}
        onCancel={() => setVoidItem(null)}
      />
    </div>
  )
}
