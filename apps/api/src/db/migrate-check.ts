import { readMigrationFiles } from 'drizzle-orm/migrator'

export type AppliedMigration = { hash: string; createdAt: number }
// applied가 null이면 drizzle 적용 기록 표가 없다(마이그레이션을 한 번도 적용하지 않은 DB).
export type TargetState = { publicTables: number; applied: AppliedMigration[] | null }
export type LocalMigration = { hash: string; folderMillis: number }
export type MigrationCheck = { ok: true; pending: number } | { ok: false; reason: 'NOT_EMPTY' | 'HISTORY_MISMATCH' }

// 적용 전 점검(AGENTS.md 마이그레이션 절). 기록이 없는 DB는 비어 있어야 한다(바꾸는 날의 새 DB).
// 기록 표만 있고 줄이 없어도 같다. 기록이 있으면 로컬 파일과 순서·해시·시각까지 같아야 한다. 옛 DB(옛 마이그레이션 29개)를 가리키면 여기서 멈춘다.
export function checkTarget(state: TargetState, local: readonly LocalMigration[]): MigrationCheck {
  if (!state.applied?.length) return state.publicTables === 0 ? { ok: true, pending: local.length } : { ok: false, reason: 'NOT_EMPTY' }
  if (state.applied.length > local.length) return { ok: false, reason: 'HISTORY_MISMATCH' }
  const same = state.applied.every((applied, index) => applied.hash === local[index]!.hash && applied.createdAt === local[index]!.folderMillis)
  return same ? { ok: true, pending: local.length - state.applied.length } : { ok: false, reason: 'HISTORY_MISMATCH' }
}

// 적용 대상. 기본은 이 프로젝트의 .env다. 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.
// 셸에 남은 주소로 모르게 배포 DB에 적용하지 않도록, 플래그 없이 셸에 주소가 있으면 멈춘다.
export type TargetSource = { source: 'shell'; url: string } | { source: '.env' } | { stop: 'SHELL_URL_WITHOUT_FLAG' | 'FLAG_WITHOUT_SHELL_URL' }
export function targetSourceOf(fromShell: boolean, shellUrl: string | undefined): TargetSource {
  const url = shellUrl?.trim()
  if (fromShell) return url ? { source: 'shell', url } : { stop: 'FLAG_WITHOUT_SHELL_URL' }
  return url ? { stop: 'SHELL_URL_WITHOUT_FLAG' } : { source: '.env' }
}

export const localMigrations = (migrationsFolder: string): LocalMigration[] =>
  readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({ hash, folderMillis }))

// 대상 DB의 상태를 읽기만 한다. query는 SQL 하나를 실행해 행을 돌려준다(postgres-js의 unsafe, PGlite의 query 모두 맞춘다).
export async function readTargetState(query: (text: string) => Promise<Record<string, unknown>[]>): Promise<TargetState> {
  const [tables] = await query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'")
  const [history] = await query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present")
  const applied = history?.present
    ? (await query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).map(row => ({ hash: String(row.hash), createdAt: Number(row.created_at) }))
    : null
  return { publicTables: Number(tables?.n ?? 0), applied }
}

// 화면에 찍을 대상: 호스트와 DB 이름만. 사용자 이름과 비밀번호, 쿼리는 찍지 않는다.
export function describeTarget(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return '(주소를 읽지 못했다)'
  }
}
