import { checkTarget, describeTarget, parseMigrateArgs, readTargetState, targetSourceOf, type LocalMigration, type MigrateArgs, type TargetSource } from './migrate-check.js'

// 적용 스크립트의 판단 전부. migrate.ts는 실제 연결(postgres-js)을 이어 주기만 한다. 시험은 PGlite를 감싼 가짜 connect로 돌린다.
export type MigrationConnection = {
  // SQL 하나를 실행해 행을 돌려준다(읽기 전용으로만 쓴다)
  query: (text: string) => Promise<Record<string, unknown>[]>
  // 남은 마이그레이션을 모두 적용한다
  apply: () => Promise<void>
  end: () => Promise<void>
}
export type MigrationRun = {
  args: readonly string[]
  env: { readonly npm_config_dry_run?: string | undefined }
  shellUrl: string | undefined
  readEnvUrl: () => string | undefined
  readLocal: () => LocalMigration[]
  connect: (url: string) => MigrationConnection
  log: { info: (line: string) => void; error: (line: string) => void }
}

const STOP_MESSAGES: Record<Extract<MigrateArgs | TargetSource, { stop: string }>['stop'], string> = {
  UNKNOWN_ARGUMENT: '알 수 없는 인자가 있다. 쓸 수 있는 것은 --apply, --dry-run, --from-shell뿐이다. 아무것도 하지 않았다.',
  APPLY_WITH_DRY_RUN: '--apply와 --dry-run은 같이 줄 수 없다. 아무것도 하지 않았다.',
  NPM_SWALLOWED_DRY_RUN: 'npm이 --dry-run을 자기 옵션으로 받았다. 플래그 앞에 --를 붙인다(npm run db:migrate --workspace @vada/api -- --dry-run). 아무것도 하지 않았다.',
  SHELL_URL_WITHOUT_FLAG: '셸에 DATABASE_URL이 있다. 그 DB에 적용하려면 --from-shell을 붙이고, .env의 DB에 적용하려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.',
  FLAG_WITHOUT_SHELL_URL: '--from-shell을 줬지만 셸에 DATABASE_URL이 없다. 아무것도 하지 않았다.',
}

const CHECK_MESSAGES = {
  NOT_EMPTY: '적용 기록이 없거나 비었는데 표가 있다. 빈 DB가 아니므로 적용하지 않는다.',
  HISTORY_MISMATCH: '이미 적용된 기록이 로컬 마이그레이션과 순서나 해시가 다르다. 적용하지 않는다.',
  LOCAL_ORDER: '로컬 마이그레이션 파일의 시각이 커지는 순서가 아니다. 적용하지 않는다.',
} as const

// 종료 코드를 돌려준다(0이 성공). 인자와 대상이 어긋나면 .env를 읽지도 연결하지도 않고 멈춘다.
// 기본은 미리 보기다: 대상과 점검 결과만 찍는다. --apply를 줄 때만, 점검을 통과한 뒤에 적용한다.
// 화면에는 호스트와 DB 이름, 개수, 오류 코드만 찍는다. 주소, 비밀번호, 오류 원문은 찍지 않는다.
export async function runMigration(run: MigrationRun): Promise<number> {
  const options = parseMigrateArgs(run.args, run.env)
  if ('stop' in options) {
    run.log.error(STOP_MESSAGES[options.stop])
    return 1
  }
  const target = targetSourceOf(options.fromShell, run.shellUrl)
  if ('stop' in target) {
    run.log.error(STOP_MESSAGES[target.stop])
    return 1
  }
  let connection: MigrationConnection | undefined
  try {
    const url = target.source === 'shell' ? target.url : run.readEnvUrl()
    if (!url) throw new Error('DATABASE_URL is missing')
    run.log.info(`대상: ${describeTarget(url)} (${target.source === 'shell' ? '셸의 DATABASE_URL' : '.env'})`)
    const local = run.readLocal()
    connection = run.connect(url)
    const state = await readTargetState(connection.query)
    run.log.info(`public 표 ${state.publicTables}개, 적용 기록 ${state.applied?.length ?? '없음'}, 로컬 마이그레이션 ${local.length}개`)
    const check = checkTarget(state, local)
    if (!check.ok) {
      run.log.error(CHECK_MESSAGES[check.reason])
      return 1
    }
    if (!options.apply) {
      run.log.info(`적용할 마이그레이션 ${check.pending}개. 미리 보기라 바꾸지 않았다. 실제로 적용하려면 --apply를 붙인다.`)
      return 0
    }
    await connection.apply()
    // 적용 호출이 돌아왔다는 것과 기록이 늘었다는 것은 다르다. 기록을 다시 읽어 실제로 적용된 개수를 찍는다.
    const after = await readTargetState(connection.query)
    run.log.info(`마이그레이션 적용 완료(${(after.applied?.length ?? 0) - (state.applied?.length ?? 0)}개)`)
    return 0
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    run.log.error(`마이그레이션 실패. 연결 문자열과 오류 원문은 출력하지 않습니다. ${/^[A-Z0-9_]+$/.test(code) ? code : ''}`.trim())
    return 1
  } finally {
    // 닫다 실패해도 결과는 바꾸지 않는다.
    try {
      await connection?.end()
    } catch {
      // 무시
    }
  }
}
