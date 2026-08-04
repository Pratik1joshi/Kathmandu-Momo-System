'use client';

/**
 * Client-side permission gate for UI. Fetches the signed-in user's effective
 * permissions once (module-cached) from /api/permissions and exposes `can()`.
 * The server is always the real gate — this just hides actions the role can't
 * perform. `can()` is optimistic (true) until the fetch resolves to avoid a
 * flash of hidden buttons.
 */
import { useEffect, useState } from 'react';

let cache = null;

export function clearPermissionsCache() {
  cache = null;
}

export function usePermissions() {
  const [perms, setPerms] = useState(cache);

  useEffect(() => {
    if (cache) { setPerms(cache); return; }
    const token = typeof window !== 'undefined' ? localStorage.getItem('pos_token') : null;
    if (!token) return;
    fetch('/api/permissions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.permissions) { cache = d.permissions; setPerms(cache); } })
      .catch(() => {});
  }, []);

  const can = (action) => (perms ? !!perms[action] : true);
  return { can, ready: !!perms, permissions: perms };
}
