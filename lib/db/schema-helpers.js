/**
 * Driver-safe schema introspection helpers (SQLite + PostgreSQL).
 */

export async function columnExists(db, table, column) {
  if (!db || !table || !column) return false;
  try {
    const isPg =
      db.driver === 'postgres' ||
      (typeof process !== 'undefined' &&
        process.env.DATABASE_URL &&
        /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL));
    if (isPg) {
      const row = await db.get(
        `SELECT 1 AS ok
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ?
           AND column_name = ?
         LIMIT 1`,
        [String(table).toLowerCase(), String(column).toLowerCase()]
      );
      return !!row;
    }
    const cols = await db.all(`PRAGMA table_info(${table})`);
    return (cols || []).some((c) => c.name === column);
  } catch {
    return false;
  }
}

export async function ensureColumn(db, table, column, typeSql) {
  if (await columnExists(db, table, column)) return false;
  await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  return true;
}

export function serialPkSql(db) {
  return db?.driver === 'postgres'
    ? 'id SERIAL PRIMARY KEY'
    : 'id INTEGER PRIMARY KEY AUTOINCREMENT';
}
