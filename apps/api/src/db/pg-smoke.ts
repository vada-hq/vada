import { randomInt } from 'node:crypto'
import { errorCodeOf } from './error-code.js'
import { describeTarget, UNREADABLE_TARGET, UNSHOWN_TARGET_MESSAGE } from './migrate-check.js'
import type { SmokeCase, SmokeContext, SmokeVerdict } from './pg-smoke-cases.js'
import type { SmokeConnection } from './pg-smoke-connection.js'

// 잠깐 쓸 DB 이름: vada_smoke_<년월일시분초(UTC)>_<난수 4자>. 소문자·숫자·밑줄뿐이라 따옴표 없이도 안전하다.
const SUFFIX_RADIX = 36
const SUFFIX_LENGTH = 4
const TIMESTAMP_DIGITS = 14
const EXIT_NO_PRIVILEGE = 2
const randomSuffix = () =>
  randomInt(SUFFIX_RADIX ** SUFFIX_LENGTH)
    .toString(SUFFIX_RADIX)
    .padStart(SUFFIX_LENGTH, '0')
export function smokeDatabaseName(now: Date, suffix = randomSuffix()): string {
  return `vada_smoke_${now.toISOString().replace(/\D/g, '').slice(0, TIMESTAMP_DIGITS)}_${suffix}`
}

// 같은 서버의 다른 DB로 이은 주소. 경로(DB 이름)만 바꾸고 사용자, 비밀번호(인코딩된 채로), 호스트, 포트, 쿼리는 그대로 둔다.
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${encodeURIComponent(database)}`
  return parsed.toString()
}

const MIN_MAJOR_VERSION = 18

// 점검을 시작해도 되는 서버인지 본다. 아니면 멈출 이유를 돌려준다. 버전을 먼저 본다.
// 거래 격리는 READ COMMITTED(PostgreSQL 기본)에 기대는 코드(authorizeChange)가 있어서, 다른 값이면 점검 결과가 운영과 달라진다.
export function serverProblem(version: unknown, isolation: unknown): string | undefined {
  const major = Number.parseInt(String(version), 10)
  if (!(major >= MIN_MAJOR_VERSION))
    return `서버가 PostgreSQL ${MIN_MAJOR_VERSION} 이상이어야 한다(지금 ${Number.isNaN(major) ? '읽지 못함' : major}). 아무것도 만들지 않았다.`
  if (isolation !== 'read committed')
    return `default_transaction_isolation이 read committed여야 한다(지금 ${typeof isolation === 'string' ? isolation : '읽지 못함'}). 아무것도 만들지 않았다.`
  return undefined
}

// 다른 연결이 users 행을 잠근 동안 세션 행을 넣는 일이 끝나야 하는 한도(ms)
const SESSION_LIMIT_MS = 2000
const SECRET_NOTE = '연결 문자열과 오류 원문은 출력하지 않습니다.'

export type SmokeRun = {
  // 같은 서버의 관리 주소(DATABASE_URL). 호출하는 쪽이 node --env-file로 환경에 넣는다. 이 도구는 .env를 읽지 않는다.
  databaseUrl: string | undefined
  connect: (url: string) => SmokeConnection
  // 그 주소의 DB에 마이그레이션을 모두 적용한다
  migrate: (url: string) => Promise<void>
  cases: readonly SmokeCase[]
  now: () => Date
  log: { info: (line: string) => void; error: (line: string) => void }
}

// 사례 하나를 돌려 판정을 돌려준다. 던지면 실패로 바꾼다.
async function judged(smokeCase: SmokeCase, context: SmokeContext): Promise<SmokeVerdict> {
  try {
    return await smokeCase.run(context)
  } catch (error) {
    return { ok: false, detail: '오류로 끝났다', code: errorCodeOf(error) || 'ERROR' }
  }
}

// 종료 코드를 돌려준다. 0은 모두 통과, 1은 실패(사례 실패, 서버 조건 미달, 지우기 실패 포함), 2는 CREATE DATABASE 권한이 없다.
// 같은 서버에 잠깐 쓸 DB를 만들어 마이그레이션하고 사례를 돌린 뒤 지운다. 끝나는 길이 어떻든 연결을 닫고 그 DB를 지운다.
// 화면에는 호스트와 DB 이름, 판정 줄, 오류 코드만 찍는다. 주소, 비밀번호, 오류 원문은 찍지 않는다.
export async function runPgSmoke(run: SmokeRun): Promise<number> {
  const url = run.databaseUrl?.trim()
  if (!url) {
    run.log.error(
      'DATABASE_URL이 없다. apps/api에서 npx tsx --env-file=../../.env scripts/pg-smoke.ts처럼 환경 파일을 넘겨 실행한다. 아무것도 하지 않았다.',
    )
    return 1
  }
  const shown = describeTarget(url)
  run.log.info(`대상: ${shown}`)
  if (shown === UNREADABLE_TARGET) {
    run.log.error(UNSHOWN_TARGET_MESSAGE)
    return 1
  }

  // 클로저 안에서 바뀌는 값이라 객체에 둔다. database는 만들었을 수 있는 점검 DB다.
  const open: { admin: SmokeConnection | undefined; database: string | undefined } = {
    admin: undefined,
    database: undefined,
  }
  // 사례에 준 연결은 사례가 닫지 않았어도 끝에서 닫는다. 두 번 닫혀도 한 번만 부른다.
  const handedOut: SmokeConnection[] = []
  const track = (connection: SmokeConnection): SmokeConnection => {
    let ending: Promise<void> | undefined
    const tracked = { ...connection, end: () => (ending ??= connection.end()) }
    handedOut.push(tracked)
    return tracked
  }

  const start = async (admin: SmokeConnection): Promise<number> => {
    const [version] = await admin.sql.unsafe('SHOW server_version')
    const [isolation] = await admin.sql.unsafe('SHOW default_transaction_isolation')
    const problem = serverProblem(version?.server_version, isolation?.default_transaction_isolation)
    if (problem) {
      run.log.error(problem)
      return 1
    }
    const database = smokeDatabaseName(run.now())
    open.database = database
    try {
      await admin.sql.unsafe(`CREATE DATABASE "${database}"`)
    } catch (error) {
      // 권한이 없다는 확실한 거절이면 만들어진 것이 없다. 그 밖의 실패는 만들어졌을 수 있어 끝에서 지우기를 시도한다.
      if (errorCodeOf(error) !== '42501') throw error
      open.database = undefined
      run.log.error(
        'CREATE DATABASE 권한이 없다(42501). 이 계정으로는 점검 DB를 만들 수 없어 아무것도 하지 않았다.',
      )
      return EXIT_NO_PRIVILEGE
    }
    run.log.info(`점검 DB: ${database} (만들었다)`)
    const smokeUrl = withDatabase(url, database)
    await run.migrate(smokeUrl)
    run.log.info('마이그레이션 적용 완료')
    const context: SmokeContext = {
      connect: () => track(run.connect(smokeUrl)),
      now: run.now(),
      sessionLimitMs: SESSION_LIMIT_MS,
    }
    let failed = 0
    for (const smokeCase of run.cases) {
      const verdict = await judged(smokeCase, context)
      if (verdict.ok) {
        run.log.info(`통과: ${smokeCase.name} — ${verdict.detail}`)
      } else {
        failed += 1
        run.log.error(`실패: ${smokeCase.name} — ${verdict.detail} (${verdict.code})`)
      }
    }
    run.log.info(failed === 0 ? '모두 통과' : `${failed}개 실패`)
    return failed === 0 ? 0 : 1
  }

  let exit = 1
  try {
    open.admin = run.connect(url)
    exit = await start(open.admin)
  } catch (error) {
    run.log.error(`점검 실패. ${SECRET_NOTE} ${errorCodeOf(error)}`.trim())
  } finally {
    // 지우기 전에 연결을 닫는다(WITH (FORCE)가 남은 연결을 끊기는 하지만 깔끔하게 닫고 지운다). 닫다 실패해도 결과는 바꾸지 않는다.
    await Promise.allSettled(handedOut.map(connection => Promise.resolve().then(connection.end)))
    if (open.admin && open.database) {
      try {
        await open.admin.sql.unsafe(`DROP DATABASE IF EXISTS "${open.database}" WITH (FORCE)`)
        run.log.info(`점검 DB를 지웠다: ${open.database}`)
      } catch (error) {
        run.log.error(
          `점검 DB를 지우지 못했다. 직접 지운다: ${open.database} ${errorCodeOf(error)}`.trim(),
        )
        exit = 1
      }
    }
    try {
      await open.admin?.end()
    } catch {
      // 무시
    }
  }
  return exit
}
