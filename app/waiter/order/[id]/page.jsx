'use client'

import { useParams } from 'next/navigation'
import OrderManager from '@/components/pos/order-manager'

export default function WaiterOrderPage() {
  const params = useParams()
  // Waiters take orders and hand off to the cashier for payment (canPay=false).
  return <OrderManager orderId={params.id} basePath="/waiter" homePath="/waiter" canPay={false} />
}
