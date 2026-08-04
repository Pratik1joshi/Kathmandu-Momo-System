'use client'

import { useParams } from 'next/navigation'
import OrderManager from '@/components/pos/order-manager'

export default function AdminOrderPage() {
  const params = useParams()
  // Admin bills in-module: Take Payment → /admin/bill/[id].
  return <OrderManager orderId={params.id} basePath="/admin" homePath="/admin/billing" canPay />
}
