import { readMigrationFiles } from 'drizzle-orm/migrator'

export type AppliedMigration = { hash: string; createdAt: number }
// applied가 null이면 drizzle 적용 기록 표가 없다(마이그레이션을 한 번도 적용하지 않은 DB).
export type TargetState = { publicTables: number; applied: AppliedMigration[] | null }
export type LocalMigration = { hash: string; folderMillis: number }
export type MigrationCheck =
  | { ok: true; pending: number }
  | { ok: false; reason: 'NOT_EMPTY' | 'HISTORY_MISMATCH' | 'LOCAL_ORDER' }

// 적용 전 점검(AGENTS.md 마이그레이션 절). 기록이 없는 DB는 비어 있어야 한다(바꾸는 날의 새 DB).
// 기록 표만 있고 줄이 없어도 같다. 기록이 있으면 로컬 파일과 순서·해시·시각까지 같아야 한다. 옛 DB(옛 마이그레이션 29개)를 가리키면 여기서 멈춘다.
// drizzle은 기록의 마지막 시각보다 늦은 마이그레이션만 적용하므로, 로컬 시각이 엄격히 커지지 않으면 앞선 파일이 조용히 건너뛰어진다. 그래서 대상을 보기 전에 로컬부터 본다.
export function checkTarget(state: TargetState, local: readonly LocalMigration[]): MigrationCheck {
  if (local.some((item, index) => index > 0 && item.folderMillis <= local[index - 1]!.folderMillis))
    return { ok: false, reason: 'LOCAL_ORDER' }
  if (!state.applied?.length)
    return state.publicTables === 0
      ? { ok: true, pending: local.length }
      : { ok: false, reason: 'NOT_EMPTY' }
  if (state.applied.length > local.length) return { ok: false, reason: 'HISTORY_MISMATCH' }
  const same = state.applied.every(
    (applied, index) =>
      applied.hash === local[index]!.hash && applied.createdAt === local[index]!.folderMillis,
  )
  return same
    ? { ok: true, pending: local.length - state.applied.length }
    : { ok: false, reason: 'HISTORY_MISMATCH' }
}

// 적용 대상. 기본은 이 프로젝트의 .env다. 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.
// 셸에 남은 주소로 모르게 배포 DB에 적용하지 않도록, 플래그 없이 셸에 주소가 있으면 멈춘다.
export type TargetSource =
  | { source: 'shell'; url: string }
  | { source: '.env' }
  | { stop: 'SHELL_URL_WITHOUT_FLAG' | 'FLAG_WITHOUT_SHELL_URL' }
export function targetSourceOf(fromShell: boolean, shellUrl: string | undefined): TargetSource {
  const url = shellUrl?.trim()
  if (fromShell) return url ? { source: 'shell', url } : { stop: 'FLAG_WITHOUT_SHELL_URL' }
  return url ? { stop: 'SHELL_URL_WITHOUT_FLAG' } : { source: '.env' }
}

// 실행 인자. 기본은 미리 보기(아무것도 바꾸지 않음)이고, 실제 적용은 --apply를 줄 때만 한다.
// 쓸 수 있는 것은 --apply, --dry-run(미리 보기를 분명히 적는 것), --from-shell뿐이다. 오타나 값은 연결하기 전에 멈춘다.
// npm이 --dry-run을 자기 옵션으로 삼키면(플래그 앞의 --를 빠뜨리면) 환경 변수로 드러난다. 그것도 멈춘다.
export type MigrateArgs =
  | { apply: boolean; fromShell: boolean }
  | { stop: 'UNKNOWN_ARGUMENT' | 'APPLY_WITH_DRY_RUN' | 'NPM_SWALLOWED_DRY_RUN' }
export function parseMigrateArgs(
  args: readonly string[],
  env: { readonly npm_config_dry_run?: string | undefined },
): MigrateArgs {
  // npm은 --dry-run=false를 빈 값으로 넘긴다.
  if (env.npm_config_dry_run && env.npm_config_dry_run !== 'false')
    return { stop: 'NPM_SWALLOWED_DRY_RUN' }
  if (!args.every(arg => arg === '--apply' || arg === '--dry-run' || arg === '--from-shell'))
    return { stop: 'UNKNOWN_ARGUMENT' }
  const apply = args.includes('--apply')
  if (apply && args.includes('--dry-run')) return { stop: 'APPLY_WITH_DRY_RUN' }
  return { apply, fromShell: args.includes('--from-shell') }
}

export const localMigrations = (migrationsFolder: string): LocalMigration[] =>
  readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({ hash, folderMillis }))

// 대상 DB의 상태를 읽기만 한다. query는 SQL 하나를 실행해 행을 돌려준다(postgres-js의 unsafe, PGlite의 query 모두 맞춘다).
export async function readTargetState(
  query: (text: string) => Promise<Record<string, unknown>[]>,
): Promise<TargetState> {
  const [tables] = await query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'",
  )
  const [history] = await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  )
  const applied = history?.present
    ? (
        await query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')
      ).map(row => ({ hash: String(row.hash), createdAt: Number(row.created_at) }))
    : null
  return { publicTables: Number(tables?.n ?? 0), applied }
}

// 화면에 찍을 대상: 호스트와 DB 이름만. 사용자 이름과 비밀번호, 쿼리는 찍지 않는다.
// 비밀번호에 /, ?, #이 섞여 주소가 다르게 읽히면(사용자 이름이 비거나, @가 경로·쿼리·해시로 밀린다) 호스트로 읽힌 조각에 비밀번호가 들어 있을 수 있어 아무것도 찍지 않는다.
export const UNREADABLE_TARGET = '(주소를 읽지 못했다)'
export function describeTarget(url: string) {
  try {
    const parsed = new URL(url)
    if (
      (!parsed.username && url.includes('@')) ||
      parsed.pathname.includes('@') ||
      parsed.search.includes('@') ||
      parsed.hash.includes('@')
    )
      return UNREADABLE_TARGET
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return UNREADABLE_TARGET
  }
}

// 실제로 쓰는 일(--apply)은 대상을 화면에 보여 줄 수 있을 때만 한다. 보여 주지 못하면 사람이 어느 DB에 쓰는지 확인할 수 없다.
export const UNSHOWN_TARGET_MESSAGE =
  '대상을 보여 줄 수 없어 적용하지 않는다. 비밀번호에 / ? # @ 가 있으면 %2F %3F %23 %40 로 바꿔 적는다. 아무것도 하지 않았다.'
