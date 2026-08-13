'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Minus, Search, ShoppingCart, Send, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message'
import MenuItemImage from '@/components/menu-item-image'
import CustomerModePicker, {
  emptyCustomerSelection,
  validateCustomerSelection,
} from '@/components/billing/customer-mode-picker'
import { printKot } from '@/lib/pos-print.js'

const takeawayCustomerEmpty = {
  ...emptyCustomerSelection,
  mode: 'customer',
  name: '',
}

function NewOrderContent() {
  const { apiCall } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()

  const [menuItems, setMenuItems] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [tables, setTables] = useState([])
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [orderType, setOrderType] = useState('dine-in')
  const [customerSelection, setCustomerSelection] = useState(takeawayCustomerEmpty)
  const [submitting, setSubmitting] = useState(false)
  const [existingOrderId, setExistingOrderId] = useState(null)
  const [kotNote, setKotNote] = useState('')
  const [pulseId, setPulseId] = useState(null)
  const pulseTimer = useRef(null)
  const [settings, setSettings] = useState({})

  useEffect(() => {
    fetchMenuAndTables()
    const tableId = searchParams.get('table')
    const orderId = searchParams.get('order')
    if (tableId) fetchTableDetails(tableId)
    if (orderId) {
      setExistingOrderId(orderId)
      fetchExistingOrder(orderId)
    }
    apiCall('/api/admin/settings').then((r) => r.json()).then((d) => setSettings(d.settings || {})).catch(() => {})
  }, [])

  const fetchMenuAndTables = async () => {
    try {
      const [menuRes, tablesRes] = await Promise.all([
        apiCall('/api/restaurant/menu'),
        apiCall('/api/restaurant/tables?status=available'),
      ])
      if (menuRes.ok) {
        const data = await menuRes.json()
        setMenuItems(data.items || [])
        const cats = [...new Set((data.items || []).map((i) => i.category).filter(Boolean))]
        setCategories(cats)
      }
      if (tablesRes.ok) {
        const data = await tablesRes.json()
        setTables(data.tables || [])
      }
    } catch (e) {
      addToast(friendlyFromError(e, 'load_failed'))
    }
  }

  const fetchTableDetails = async (tableId) => {
    try {
      const res = await apiCall(`/api/restaurant/tables/${tableId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTable(data.table)
        setOrderType('dine-in')
      }
    } catch {
      /* ignore */
    }
  }

  const fetchExistingOrder = async (orderId) => {
    try {
      const res = await apiCall(`/api/admin/pos/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        const order = data.workspace?.order
        if (!order) return
        setOrderType(order.order_type?.includes('take') ? 'takeaway' : 'dine-in')
        if (order.table_id) await fetchTableDetails(order.table_id)
        if (order.customer_phone || order.customer_name) {
          setCustomerSelection({
            mode: 'customer',
            phone: String(order.customer_phone || '').replace(/\D/g, ''),
            name: order.customer_name || '',
            address: '',
            customer: null,
            isNew: false,
          })
        }
      }
    } catch {
      /* ignore */
    }
  }

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const name = (item.item_name || item.name || '').toLowerCase()
    const matchesSearch = name.includes(searchQuery.toLowerCase())
    const available = item.is_available === 1 || item.is_available === true || item.is_available === '1'
    return matchesCategory && matchesSearch && available
  })

  const flash = (id) => {
    setPulseId(id)
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulseId(null), 280)
  }

  const addToCart = (item) => {
    const itemId = item.item_id || item.id
    flash(itemId)
    setCart((prev) => {
      const existing = prev.find((i) => (i.item_id || i.id) === itemId)
      if (existing) {
        return prev.map((i) =>
          (i.item_id || i.id) === itemId ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          ...item,
          item_id: itemId,
          item_name: item.item_name || item.name,
          quantity: 1,
          special_instructions: '',
        },
      ]
    })
  }

  const updateQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if ((item.item_id || item.id) !== itemId) return item
          const q = item.quantity + delta
          return q <= 0 ? null : { ...item, quantity: q }
        })
        .filter(Boolean)
    )
  }

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const getQty = (id) => cart.find((i) => (i.item_id || i.id) === id)?.quantity || 0

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      addToast(friendlyMessage('empty_cart'))
      return
    }
    if (!existingOrderId) {
      if (orderType === 'dine-in' && !selectedTable) {
        setShowTableDialog(true)
        return
      }
      if (orderType === 'takeaway') {
        const check = validateCustomerSelection(customerSelection)
        if (!check.ok) {
          addToast({
            title: check.message || 'Customer details needed',
            description: 'Enter phone first. Existing customers load automatically; new numbers need a name.',
            variant: 'warning',
          })
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const payloadItems = cart.map((item) => ({
        menu_item_id: item.item_id,
        quantity: item.quantity,
        price: item.price,
        special_instructions: item.special_instructions || null,
      }))

      let orderId = existingOrderId

      if (!orderId) {
        const customerCheck =
          orderType === 'takeaway' ? validateCustomerSelection(customerSelection) : { ok: true }
        const createRes = await apiCall('/api/admin/pos/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: orderType === 'dine-in' ? (selectedTable.table_id || selectedTable.id) : null,
            order_type: orderType,
            customer_name: orderType === 'takeaway' ? customerCheck.name : null,
            customer_phone: orderType === 'takeaway' ? customerCheck.phone : null,
            notes: kotNote.trim() || null,
          }),
        })
        const createData = await createRes.json().catch(() => ({}))
        if (!createRes.ok) throw new Error(createData.error || 'Failed')
        orderId = createData.order_id
      }

      const itemsRes = await apiCall(`/api/admin/pos/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      })
      const itemsData = await itemsRes.json().catch(() => ({}))
      if (!itemsRes.ok) throw new Error(itemsData.error || 'Failed')

      const kotRes = await apiCall(`/api/admin/pos/orders/${orderId}/kot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: `${orderId}-${Date.now()}`,
          order_notes: kotNote.trim() || null,
        }),
      })
      const kotData = await kotRes.json().catch(() => ({}))
      if (!kotRes.ok) throw new Error(kotData.error || 'Failed')

      const autoPrintKot = String(settings.kitchen_printing_enabled ?? 'false') === 'true'
      if (kotData.kot && autoPrintKot) {
        printKot(kotData.kot, { size: settings.receipt_paper_size || '80' })
      }

      addToast(friendlyMessage(existingOrderId ? 'items_added' : 'order_success', {
        description: kotData.kot?.kot_number ? `${kotData.kot.kot_number} sent to kitchen.` : undefined,
      }))
      router.push(`/waiter/order/${orderId}`)
    } catch (e) {
      addToast(friendlyFromError(e, 'order_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const CartPanel = ({ mobile }) => (
    <div className={`flex flex-col ${mobile ? 'h-full' : 'h-[calc(100vh-8rem)]'}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Cart ({cartItemCount})
        </h2>
        {mobile && (
          <button type="button" onClick={() => setShowCart(false)} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">Tap a dish to add it</p>
        ) : (
          cart.map((item) => (
            <div key={item.item_id} className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <MenuItemImage src={item.image_url} alt={item.item_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.item_name}</p>
                <p className="text-xs text-slate-500">Rs {item.price}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.item_id, -1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.item_id, 1)}
                    className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-900">
                Rs {(item.price * item.quantity).toFixed(0)}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="p-4 border-t border-slate-100 space-y-3 bg-white">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            KOT Note / Special Request
          </label>
          <textarea
            rows={2}
            value={kotNote}
            onChange={(e) => setKotNote(e.target.value)}
            placeholder="Less spicy, no onion, allergy: peanuts..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex justify-between text-lg font-bold text-slate-900">
          <span>Total</span>
          <span>Rs {cartTotal.toFixed(0)}</span>
        </div>
        <button
          type="button"
          disabled={submitting || cart.length === 0}
          onClick={handleSubmitOrder}
          className="w-full h-12 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Sending…' : existingOrderId ? 'Send to Kitchen' : 'Place Order'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-slate-900 truncate">
              {existingOrderId ? 'Add items' : 'New order'}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {selectedTable
                ? `Table ${selectedTable.table_number}`
                : existingOrderId
                  ? 'Adding to open order'
                  : orderType === 'takeaway'
                    ? 'Takeaway'
                    : 'Select a table'}
            </p>
          </div>
          {!existingOrderId && (
            <div className="flex rounded-xl bg-slate-100 p-0.5">
              {['dine-in', 'takeaway'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setOrderType(t)
                    if (t === 'takeaway') setCustomerSelection(takeawayCustomerEmpty)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                    orderType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {t === 'dine-in' ? 'Dine in' : 'Takeaway'}
                </button>
              ))}
            </div>
          )}
        </div>

        {!existingOrderId && orderType === 'dine-in' && !selectedTable && (
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setShowTableDialog(true)}
              className="w-full h-10 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600"
            >
              Select table
            </button>
          </div>
        )}
        {!existingOrderId && orderType === 'takeaway' && (
          <div className="px-4 pb-3">
            <CustomerModePicker
              value={customerSelection}
              onChange={setCustomerSelection}
              compact
              hideWalkIn
            />
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3 pb-28 lg:pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu…"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredItems.map((item) => {
                const id = item.item_id || item.id
                const qty = getQty(id)
                const name = item.item_name || item.name
                const pulsing = pulseId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => addToCart(item)}
                    className={`text-left rounded-xl bg-white border overflow-hidden shadow-sm transition-transform duration-200 active:scale-[0.97] ${
                      pulsing ? 'scale-[0.96] ring-2 ring-slate-900' : ''
                    } ${qty > 0 ? 'border-slate-900' : 'border-slate-200'}`}
                  >
                    <div className="relative aspect-square bg-slate-100">
                      <MenuItemImage
                        src={item.image_url}
                        alt={name}
                        size="card"
                        className="!w-full !h-full !rounded-none"
                      />
                      {qty > 0 && (
                        <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      {item.category && (
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-white/95 text-[9px] font-semibold text-slate-700 border border-slate-200 max-w-[70%] truncate">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="flex items-start gap-1">
                        <p className="flex-1 font-semibold text-xs text-slate-900 leading-snug line-clamp-2">
                          {name}
                        </p>
                        <span
                          className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.is_veg || item.is_vegetarian ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <p className="mt-0.5 text-xs font-bold text-slate-900">Rs {item.price}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {filteredItems.length === 0 && (
              <p className="text-center text-slate-400 py-16">No menu items found</p>
            )}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <CartPanel />
            </div>
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="w-full h-12 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-between px-4"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount} items
            </span>
            <span>Rs {cartTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="w-full max-h-[85vh] bg-white rounded-t-3xl overflow-hidden">
            <CartPanel mobile />
          </div>
        </div>
      )}

      {showTableDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Select table</h3>
              <button type="button" onClick={() => setShowTableDialog(false)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2 overflow-y-auto">
              {tables.map((table) => (
                <button
                  key={table.table_id || table.id}
                  type="button"
                  onClick={() => {
                    setSelectedTable(table)
                    setShowTableDialog(false)
                  }}
                  className="rounded-xl border border-slate-200 p-4 text-center hover:border-slate-900"
                >
                  <p className="text-xl font-bold">{table.table_number}</p>
                  <p className="text-[10px] text-slate-500">{table.capacity} seats</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
      }
    >
      <NewOrderContent />
    </Suspense>
  )
}
