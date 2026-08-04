/**
 * Convert SQLite-style `?` placeholders to Postgres `$1, $2, ...`
 */
export function toPgParams(sql, params = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

/**
 * Light dialect tweaks when running on Postgres.
 */
export function adaptSqlForPostgres(sql) {
  let s = sql;
  s = s.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
  s = s.replace(/\bdatetime\s*\(\s*'now'\s*\)/gi, 'CURRENT_TIMESTAMP');
  s = s.replace(/\bdate\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE');
  // SQLite date(col) / date(?) → Postgres cast (avoid matching INTERVAL / DATE keywords)
  s = s.replace(/\bdate\s*\(\s*(\?|[a-zA-Z_][\w.]*)\s*\)/gi, '(($1)::date)');
  // SQLite char(10) newline → Postgres chr(10)
  s = s.replace(/\bchar\s*\(\s*10\s*\)/gi, 'chr(10)');
  // SQLite GROUP_CONCAT(col, sep) → string_agg
  s = s.replace(
    /\bGROUP_CONCAT\s*\(\s*([^,]+?)\s*,\s*'([^']*)'\s*\)/gi,
    "string_agg(($1)::text, '$2')"
  );
  s = s.replace(/\bGROUP_CONCAT\s*\(\s*([^)]+?)\s*\)/gi, "string_agg(($1)::text, ',')");
  // julianday differences used for averages — approximate with epoch extract
  s = s.replace(
    /julianday\s*\(\s*([^)]+)\s*\)\s*-\s*julianday\s*\(\s*([^)]+)\s*\)/gi,
    '(EXTRACT(EPOCH FROM ($1)::timestamp) - EXTRACT(EPOCH FROM ($2)::timestamp)) / 86400.0'
  );
  return s;
}

export function isPostgresUrl(url = process.env.DATABASE_URL) {
  if (!url) return false;
  return /^postgres(ql)?:\/\//i.test(url);
}

export function requirePostgresInProduction() {
  // Allow SQLite in production on Vercel or when explicitly configured as demo/sqlite
  if (process.env.VERCEL === '1' || process.env.DEMO_MODE === '1') return;
  // `next build` sets NODE_ENV=production while collecting route data — skip then.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.SKIP_DB_ON_BUILD === '1') return;
  if (process.env.NODE_ENV === 'production' && !isPostgresUrl()) {
    throw new Error(
      'Production requires DATABASE_URL (PostgreSQL). SQLite is not supported in production.'
    );
  }
}
