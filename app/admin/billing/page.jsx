'use client';

import { useState } from 'react';
import { RotateCcw, Utensils, ShoppingBag, Bike } from 'lucide-react';
import WalkInBilling from '@/components/billing/walk-in-billing';
import TableFloorBoard from '@/components/billing/table-floor-board';
import ReopenBillModal from '@/components/billing/reopen-bill-modal';

const TABS = [
  { key: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
  { key: 'dine_in', label: 'Dine In', icon: Utensils },
  { key: 'delivery', label: 'Delivery', icon: Bike },
];

export default function AdminBillingPage() {
  const [tab, setTab] = useState('takeaway');
  const [reopenOpen, setReopenOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
        {/* Admin always has permission; button always shown. */}
        <button
          onClick={() => setReopenOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          <RotateCcw className="h-4 w-4" /> Reopen a bill
        </button>
      </div>

      {tab === 'dine_in' ? (
        <TableFloorBoard
          basePath="/admin"
          variant="order"
          title="Dine-in tables"
          subtitle="Open a table to view or add to its order, or start a new one."
        />
      ) : (
        <>
          {tab === 'delivery' && (
            <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6">
              Delivery uses the same counter-billing flow as takeaway. Record the customer’s phone and address on the bill.
            </p>
          )}
          <WalkInBilling variant="admin" />
        </>
      )}

      <ReopenBillModal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        buildHref={(id) => `/admin/order/${id}`}
      />
    </div>
  );
}
