'use client';

/**
 * Cashier console — the table-aware side of the cashier role. The dashboard
 * (/cashier) lists orders + does walk-in bills + payment; this adds the live
 * floor (open occupied tables, start dine-in, transfer / merge) and reopening a
 * closed bill. Both reuse the shared engines built earlier.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, ShoppingBag, History } from 'lucide-react';
import TableFloorBoard from '@/components/billing/table-floor-board';
import ReopenBillModal from '@/components/billing/reopen-bill-modal';
import { usePermissions } from '@/lib/use-permissions';

export default function CashierConsolePage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [reopenOpen, setReopenOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/cashier')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" /> <span className="font-semibold">Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Console</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('reopen_bills') && (
              <button
                onClick={() => setReopenOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                <RotateCcw className="h-4 w-4" /> Reopen a bill
              </button>
            )}
            <button
              onClick={() => router.push('/cashier/payment-history')}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <History className="h-4 w-4" /> History
            </button>
            <button
              onClick={() => router.push('/cashier/billing')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <ShoppingBag className="h-4 w-4" /> Walk-in bill
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl">
        <TableFloorBoard
          basePath="/cashier"
          variant="order"
          title="Tables"
          subtitle="Open a table to add items or bill it, or start a new order."
        />
      </div>

      <ReopenBillModal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        buildHref={(id) => `/cashier/order/${id}`}
      />
    </div>
  );
}
