'use client'

import { Suspense } from 'react'
import OrderBuilder from '@/components/pos/order-builder'

export default function WaiterNewOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
      <OrderBuilder basePath="/waiter" homePath="/waiter" />
    </Suspense>
  )
}
