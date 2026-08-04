'use client'

import { Suspense } from 'react'
import OrderBuilder from '@/components/pos/order-builder'

export default function AdminNewOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
      <OrderBuilder basePath="/admin" homePath="/admin/billing" />
    </Suspense>
  )
}
