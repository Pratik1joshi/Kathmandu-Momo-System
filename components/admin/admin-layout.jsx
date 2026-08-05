'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Users, Package, FileText, Settings, DollarSign, ShoppingCart,
  LayoutDashboard, Warehouse, LayoutGrid, FolderOpen, Menu, X, Inbox, ChefHat, Wallet, Truck, Trash,
  Building2, ChevronDown, Ruler, Layers, TrendingUp, Activity, BarChart3, Image,
  BookOpen, ScrollText, Coins, Landmark, CreditCard, ArrowRightLeft, Undo2, Receipt, Gauge, ClipboardCheck, MessageCircle
} from 'lucide-react';
import LogoutButton from '@/components/ui/logout-button';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [backdropReady, setBackdropReady] = useState(false);
  const [leadsBadge, setLeadsBadge] = useState(0);
  const [onlineOrdersBadge, setOnlineOrdersBadge] = useState(0);
  const [openGroups, setOpenGroups] = useState({});
  const openLockRef = useRef(false);

  // Restore expanded groups once on mount.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('admin_nav_groups') || 'null');
      if (saved && typeof saved === 'object') setOpenGroups(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleGroup = (label) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem('admin_nav_groups', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = (event) => {
      const desktop = event && typeof event.matches === 'boolean' ? event.matches : mq.matches;
      setIsDesktop(desktop);
      if (desktop) {
        const saved = localStorage.getItem('admin_sidebar_open');
        setSidebarOpen(saved !== null ? saved === 'true' : true);
      } else {
        setSidebarOpen(false);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    const token = localStorage.getItem('pos_token');
    const user = JSON.parse(localStorage.getItem('pos_user') || '{}');
    if (!token || user.role !== 'admin') router.push('/login');
    else setLoading(false);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const token = localStorage.getItem('pos_token');
        if (!token) return;
        const res = await fetch('/api/admin/reservations/alerts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          // fallback counts
          const cRes = await fetch('/api/admin/leads/counts', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cRes.ok || cancelled) return;
          const data = await cRes.json();
          const n = Number(data?.counts?.new_total || 0);
          const soon = Number(data?.counts?.arriving_soon || 0);
          setLeadsBadge(n + soon);
          return;
        }
        const data = await res.json();
        const alertN = (data.alerts || []).filter((a) =>
          ['arriving_soon', 'late', 'no_show_candidate', 'arrived', 'vip_arrived'].includes(a.type)
        ).length;
        const cRes = await fetch('/api/admin/leads/counts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        let newTotal = 0;
        if (cRes.ok) {
          const c = await cRes.json();
          newTotal = Number(c?.counts?.new_total || 0);
        }
        if (!cancelled) setLeadsBadge(newTotal + alertN);
      } catch {
        /* ignore */
      }
    };
    fetchCounts();
    const t = setInterval(fetchCounts, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [loading, pathname]);

  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const fetchOnlineCount = async () => {
      try {
        const token = localStorage.getItem('pos_token');
        if (!token) return;
        const res = await fetch('/api/admin/online-orders?status=PENDING', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setOnlineOrdersBadge(Number(data?.counts?.pending || 0));
      } catch { /* badge polling is best-effort */ }
    };
    fetchOnlineCount();
    const timer = setInterval(fetchOnlineCount, 20000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [loading, pathname]);

  // Delay backdrop so the opening tap does not immediately close the menu
  useEffect(() => {
    if (sidebarOpen && !isDesktop) {
      openLockRef.current = true;
      setBackdropReady(false);
      const t = setTimeout(() => {
        setBackdropReady(true);
        openLockRef.current = false;
      }, 180);
      return () => clearTimeout(t);
    }
    setBackdropReady(false);
    openLockRef.current = false;
  }, [sidebarOpen, isDesktop]);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    if (openLockRef.current) return;
    setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        localStorage.setItem('admin_sidebar_open', String(next));
      }
      return next;
    });
  }, []);

  const navigate = (href) => {
    router.push(href);
    if (!isDesktop) setSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    router.push('/login');
  };

  // Grouped nav. Standalone entries (Dashboard, Settings) have no `items`.
  // Add new modules by dropping an entry into the relevant group — no layout rewrite.
  const navGroups = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard', color: 'text-gray-600' },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics', color: 'text-blue-700' },
    {
      label: 'Operations',
      items: [
        { icon: Inbox, label: 'Host desk', href: '/admin/leads', color: 'text-amber-600', badge: leadsBadge },
        { icon: ShoppingCart, label: 'Orders', href: '/admin/orders', color: 'text-orange-600' },
        { icon: MessageCircle, label: 'Website & WhatsApp', href: '/admin/orders/online', color: 'text-emerald-700', badge: onlineOrdersBadge },
        { icon: DollarSign, label: 'Billing', href: '/admin/billing', color: 'text-teal-600' },
        { icon: Receipt, label: 'Bills', href: '/admin/bills', color: 'text-blue-600' },
        { icon: LayoutGrid, label: 'Tables', href: '/admin/tables', color: 'text-cyan-600' },
        { icon: Layers, label: 'Table Management', href: '/admin/table-management', color: 'text-sky-600' },
        { icon: Activity, label: 'Kitchen Analytics', href: '/admin/kitchen-analytics', color: 'text-orange-600' },
      ],
    },
    {
      label: 'Menu',
      items: [
        { icon: Package, label: 'Menu', href: '/admin/products', color: 'text-blue-600' },
        { icon: FolderOpen, label: 'Categories', href: '/admin/categories', color: 'text-purple-600' },
        { icon: ChefHat, label: 'Recipes', href: '/admin/recipes', color: 'text-rose-600' },
      ],
    },
    {
      label: 'Website',
      items: [
        { icon: Image, label: 'Website CMS', href: '/admin/cms', color: 'text-rose-600' },
        { icon: Image, label: 'Media Library', href: '/admin/cms?tab=media', color: 'text-fuchsia-600' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { icon: Gauge, label: 'Inventory Dashboard', href: '/admin/inventory/dashboard', color: 'text-indigo-700' },
        { icon: Warehouse, label: 'Inventory', href: '/admin/inventory', color: 'text-indigo-600' },
        { icon: FolderOpen, label: 'Inventory Categories', href: '/admin/inventory-categories', color: 'text-violet-600' },
        { icon: Ruler, label: 'Unit Conversion', href: '/admin/unit-conversion', color: 'text-sky-600' },
        { icon: Truck, label: 'Purchases', href: '/admin/purchases', color: 'text-teal-600' },
        { icon: Building2, label: 'Suppliers', href: '/admin/suppliers', color: 'text-slate-600' },
        { icon: Trash, label: 'Wastage', href: '/admin/wastage', color: 'text-red-600' },
      ],
    },
    {
      label: 'People',
      items: [
        { icon: Users, label: 'Employees', href: '/admin/employees', color: 'text-green-600' },
        { icon: TrendingUp, label: 'Employee Performance', href: '/admin/employee-performance', color: 'text-lime-600' },
        { icon: Users, label: 'Customers', href: '/admin/customers', color: 'text-pink-600' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { icon: Wallet, label: 'Expenses', href: '/admin/expenses', color: 'text-emerald-600' },
        { icon: FolderOpen, label: 'Expense Categories', href: '/admin/expense-categories', color: 'text-emerald-700' },
        { icon: ArrowRightLeft, label: 'Cash Exchange', href: '/admin/cash-exchange', color: 'text-amber-600' },
        { icon: FileText, label: 'Reports', href: '/admin/reports', color: 'text-purple-600' },
      ],
    },
    {
      label: 'Accounting',
      items: [
        { icon: Gauge, label: 'Finance Dashboard', href: '/admin/finance-dashboard', color: 'text-gray-900' },
        { icon: BookOpen, label: 'Chart of Accounts', href: '/admin/chart-of-accounts', color: 'text-indigo-600' },
        { icon: ScrollText, label: 'General Ledger', href: '/admin/general-ledger', color: 'text-slate-600' },
        { icon: Coins, label: 'Cash Book', href: '/admin/cash-book', color: 'text-yellow-600' },
        { icon: Landmark, label: 'Bank Book', href: '/admin/bank-book', color: 'text-blue-600' },
        { icon: ClipboardCheck, label: 'Bank Reconciliation', href: '/admin/bank-reconciliation', color: 'text-cyan-700' },
        { icon: Wallet, label: 'Cash Drawer', href: '/admin/cash-drawer', color: 'text-orange-600' },
        { icon: Landmark, label: 'Bank', href: '/admin/bank', color: 'text-teal-600' },
        { icon: CreditCard, label: 'Settlements', href: '/admin/settlements', color: 'text-rose-600' },
        { icon: Receipt, label: 'Accounts Payable', href: '/admin/accounts-payable', color: 'text-orange-700' },
        { icon: FileText, label: 'Financial Reports', href: '/admin/financial-reports', color: 'text-indigo-700' },
        { icon: Undo2, label: 'Corrections', href: '/admin/corrections', color: 'text-amber-700' },
      ],
    },
    { icon: Settings, label: 'Settings', href: '/admin/settings', color: 'text-gray-600' },
  ];

  const isActiveHref = (href) =>
    pathname === href || (href !== '/admin/dashboard' && pathname?.startsWith(href));
  // Flat list only used when the desktop rail is collapsed to icons.
  const flatItems = navGroups.flatMap((g) => (g.items ? g.items : [g]));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const showLabels = sidebarOpen || !isDesktop;

  const renderNavButton = (item, topLevel) => {
    const isActive = isActiveHref(item.href);
    return (
      <button
        key={item.href}
        type="button"
        onClick={() => navigate(item.href)}
        className={`w-full flex items-center ${
          showLabels ? `space-x-3 ${topLevel ? 'px-4' : 'pl-8 pr-4'}` : 'justify-center px-2'
        } py-2.5 rounded-lg text-left relative ${
          isActive ? 'bg-gray-100 border-l-4 border-gray-800' : 'active:bg-gray-50 hover:bg-gray-50'
        }`}
      >
        <item.icon className={`${item.color} ${showLabels ? 'w-5 h-5' : 'w-6 h-6'} flex-shrink-0`} />
        {showLabels && (
          <span className={`font-medium flex-1 ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
            {item.label}
          </span>
        )}
        {item.badge > 0 && (
          <span
            className={`${showLabels ? '' : 'absolute top-1.5 right-1.5'} min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center`}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Fixed mobile top bar — always above the aside so the hamburger is easy to tap */}
      <div className="lg:hidden print:hidden fixed top-0 inset-x-0 z-[70] bg-white border-b border-gray-200 px-2 py-1.5 flex items-center justify-between pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            if (sidebarOpen) closeMobileSidebar();
            else openSidebar();
          }}
          className="relative z-[71] h-12 w-12 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-800 touch-manipulation [-webkit-tap-highlight-color:transparent]"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h2 className="text-base font-bold text-gray-800 pointer-events-none">Admin Panel</h2>
        <div className="h-12 w-12" aria-hidden />
      </div>

      {backdropReady && sidebarOpen && !isDesktop && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[55] bg-black/20 lg:hidden touch-manipulation"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={`print:hidden fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-xl lg:shadow-none transition-transform duration-200 z-[60] flex flex-col ${
          sidebarOpen
            ? 'w-64 translate-x-0 pointer-events-auto'
            : 'w-64 -translate-x-full pointer-events-none lg:pointer-events-auto lg:w-20 lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 gap-2 pt-[max(1rem,env(safe-area-inset-top))] lg:pt-4">
          {showLabels && <h2 className="text-xl font-bold text-gray-800 truncate">Admin Panel</h2>}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden lg:flex min-h-10 min-w-10 items-center justify-center hover:bg-gray-100 rounded-lg text-gray-700 flex-shrink-0"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="lg:hidden h-12 w-12 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-800 touch-manipulation"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-1">
          {showLabels
            ? navGroups.map((group) => {
                if (!group.items) return renderNavButton(group, true);
                const hasActive = group.items.some((it) => isActiveHref(it.href));
                const expanded = openGroups[group.label] ?? hasActive;
                const groupBadge = group.items.reduce((n, it) => n + (it.badge || 0), 0);
                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
                    >
                      <span className="flex-1">{group.label}</span>
                      {!expanded && groupBadge > 0 && (
                        <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {groupBadge > 99 ? '99+' : groupBadge}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {expanded && (
                      <div className="mt-1 space-y-1">
                        {group.items.map((item) => renderNavButton(item, false))}
                      </div>
                    )}
                  </div>
                );
              })
            : flatItems.map((item) => renderNavButton(item, true))}
        </nav>

        <div className="flex-shrink-0 p-3 border-t border-gray-200">
          <LogoutButton
            onLogout={handleLogout}
            variant="sidebar"
            iconOnly={!showLabels}
            label="Logout"
            className={!showLabels ? 'justify-center px-2 space-x-0' : ''}
          />
        </div>
      </aside>

      <div
        className={`min-h-screen min-w-0 pt-14 lg:pt-0 print:!ml-0 print:!pt-0 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        } ${sidebarOpen && !isDesktop ? 'opacity-45' : 'opacity-100'}`}
      >
        <div className="admin-page-content w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
