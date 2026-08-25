'use client';

import { useState } from 'react';
import {
  Activity, BarChart3, ChefHat, ClipboardCheck, History, PackageSearch, ShoppingBasket, Users,
} from 'lucide-react';
import AnalyticsHome, { AnalyticsKeyMetrics } from './analytics-home';
import { AllChanges } from './order-operations-analytics';
import OrderOperationsAnalytics from './order-operations-analytics';

import { MenuPerformance, PaymentFinance } from './overview-commercial';
import {
  AttentionCenter, Controls,
  FloorAndReservations,
  InventorySupplier,
  LiveStatus,
  ManagementSummary,
  PeoplePerformance,
  RecentActivity,
} from './overview-operations';

export default function OverviewDashboard({
  data,
  transactionLoading = false,
  onTransactionPageChange,
  onTransactionPageSizeChange,
  onExportTransactions,
}) {
  const [view, setView] = useState('overview');
  const tabs = [
    ['overview', 'Overview', Activity],
    ['sales', 'Sales & Money', BarChart3],
    ['stock', 'Purchases & Stock', PackageSearch],
    ['menu', 'Menu & Tables', ShoppingBasket],
    ['kitchen', 'Orders & Billing', ChefHat],
    ['people', 'Customers & Team', Users],
    ['control', 'Controls & Activity', ClipboardCheck],
    // Its own top-level view, not a sub-tab of Orders & Billing: an owner asking
    // "what was cancelled, voided, refunded, re-billed or discounted today?" is
    // asking about the whole shift, not about one document type.
    ['changes', 'Cancellations & Changes', History],
  ];

  return (
    <div>
      <AnalyticsKeyMetrics data={data} />

      <div className="mb-5 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="Analytics views">
        <div className="flex min-w-max gap-1">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-[border-color,color,transform] duration-150 ease-out active:scale-[0.98] ${view === id ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {view === 'overview' && <AnalyticsHome data={data} />}
      {view === 'sales' && <div className="space-y-5"><PaymentFinance data={data} /></div>}
      {view === 'stock' && <div className="space-y-5"><InventorySupplier data={data} /></div>}
      {view === 'menu' && <div className="space-y-5"><MenuPerformance data={data} /><FloorAndReservations data={data} /></div>}
      {view === 'kitchen' && <div className="space-y-5"><LiveStatus data={data} /><OrderOperationsAnalytics data={data.orderOperations} live={data.live} /></div>}
      {view === 'people' && <div className="space-y-5"><PeoplePerformance data={data} /></div>}
      {view === 'changes' && <AllChanges report={data.orderOperations || {}} />}
      {view === 'control' && <div className="space-y-5">
        <AttentionCenter rows={data.attention} />
        <Controls data={data} />
        <RecentActivity
          data={data}
          pagination={data.transactionPagination}
          loading={transactionLoading}
          onPageChange={onTransactionPageChange}
          onPageSizeChange={onTransactionPageSizeChange}
          onExportTransactions={onExportTransactions}
        />
        <ManagementSummary data={data} />
      </div>}
    </div>
  );
}
