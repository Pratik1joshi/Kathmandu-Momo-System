'use client'

import { useParams } from 'next/navigation'
import OrderManager from '@/components/pos/order-manager'

export default function CashierOrderPage() {
  const params = useParams()
  // Cashier bills in-module: Take Payment → /cashier/bill/[id].
  return <OrderManager orderId={params.id} basePath="/cashier" homePath="/cashier/console" canPay />
}
