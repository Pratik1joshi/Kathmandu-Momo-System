'use client';

import { use } from 'react';
import BillPay from '@/components/pos/bill-pay';

export default function CashierBillPage({ params }) {
  const { id } = use(params);
  return <BillPay orderId={id} basePath="/cashier" />;
}
