import type { PGlite } from '@electric-sql/pglite'

// DB의 표, 칸, 제약, 인덱스를 한 줄씩 적는다. 두 DB를 맞대는 설계 검사(check-design.ts)가 쓴다.
// exclude에 든 표와 그 표의 제약·인덱스는 적지 않는다(설계 밖 표).
export async function describeDatabase(
  pg: PGlite,
  exclude: ReadonlySet<string>,
): Promise<string[]> {
  const columns = await pg.query<{
    table: string
    column: string
    type: string
    not_null: boolean
    default: string | null
  }>(`
    SELECT c.relname AS table, a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS default
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped`)
  const constraints = await pg.query<{ table: string; name: string; definition: string }>(`
    SELECT c.relname AS table, con.conname AS name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'`)
  const indexes = await pg.query<{ table: string; definition: string }>(
    "SELECT tablename AS table, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public'",
  )
  const extensions = await pg.query<{ name: string }>('SELECT extname AS name FROM pg_extension')
  const kept = <T extends { table: string }>(rows: T[]) =>
    rows.filter(row => !exclude.has(row.table))
  return [
    ...[...new Set(kept(columns.rows).map(row => row.table))].map(table => `표 ${table}`),
    ...kept(columns.rows).map(
      row =>
        `칸 ${row.table}.${row.column} ${row.type}${row.not_null ? ' NOT NULL' : ''}${row.default ? ` DEFAULT ${row.default}` : ''}`,
    ),
    ...kept(constraints.rows).map(row => `제약 ${row.table} ${row.name} ${row.definition}`),
    ...kept(indexes.rows).map(row => `인덱스 ${row.table} ${row.definition}`),
    ...extensions.rows.map(row => `확장 ${row.name}`),
  ].sort()
}

// 한쪽에만 있는 줄을 돌려준다. 둘 다 비면 같은 DB다.
export function catalogDifferences(design: readonly string[], migrated: readonly string[]) {
  const inMigrated = new Set(migrated)
  const inDesign = new Set(design)
  return {
    onlyInDesign: design.filter(line => !inMigrated.has(line)),
    onlyInMigration: migrated.filter(line => !inDesign.has(line)),
  }
}
