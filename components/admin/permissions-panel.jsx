'use client';

/**
 * Admin → Settings → Restaurant Permissions. Toggle what waiters and cashiers
 * may do; admin is always full access. Saves to /api/admin/permissions and the
 * change takes effect immediately (permissions are read fresh on every request).
 */
import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Check } from 'lucide-react';
import { authedRequest } from '@/lib/authed-fetch';
import { clearPermissionsCache } from '@/lib/use-permissions';

const ROLES = ['waiter', 'cashier'];

export default function PermissionsPanel() {
  const [actions, setActions] = useState([]);
  const [perms, setPerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedRequest('/api/admin/permissions');
        const data = await res.json().catch(() => ({}));
        if (res.ok) { setActions(data.actions || []); setPerms(data.permissions || {}); }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (role, key) => {
    setPerms((p) => ({ ...p, [role]: { ...p[role], [key]: !p[role]?.[key] } }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await authedRequest('/api/admin/permissions', {
        method: 'PUT',
        body: JSON.stringify({ permissions: { waiter: perms.waiter, cashier: perms.cashier } }),
      });
      if (res.ok) { clearPermissionsCache(); setSaved(true); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
        <ShieldCheck className="h-5 w-5 text-gray-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Restaurant Permissions</h2>
          <p className="text-xs text-gray-500">Control what waiters and cashiers can do. Admin always has full access.</p>
        </div>
      </div>

      {loading || !perms ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold">Action</th>
                  {ROLES.map((r) => <th key={r} className="px-4 py-3 text-center font-semibold capitalize">{r}</th>)}
                  <th className="px-4 py-3 text-center font-semibold text-gray-300">Admin</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.key} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-gray-800">{a.label}</td>
                    {ROLES.map((role) => (
                      <td key={role} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!perms[role]?.[a.key]}
                          onChange={() => toggle(role, a.key)}
                          className="h-4 w-4 rounded accent-gray-900"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center"><Check className="mx-auto h-4 w-4 text-emerald-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4">
            {saved && <span className="text-sm font-medium text-emerald-600">Saved — effective immediately.</span>}
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save permissions
            </button>
          </div>
        </>
      )}
    </section>
  );
}
