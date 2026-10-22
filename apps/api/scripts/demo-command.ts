import {
  describeTarget,
  targetSourceOf,
  UNREADABLE_TARGET,
  UNSHOWN_TARGET_MESSAGE,
} from '../src/ops/migrate/migrate-check.js'
import type { Db } from '../src/db/types.js'
import { DEMO_SCHOOL_NAME, seedDemoCouncil } from './demo-data.js'

// demo 명령의 판단 전부. manage-demo-data.ts는 실제 연결(postgres-js)을 이어 주기만 한다. 시험은 PGlite를 감싼 가짜 connect로 돌린다.
// 인자 규칙은 db:migrate와 같다: 기본은 미리 보기, 실제로 쓰는 것은 --apply뿐이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.

export type DemoArgs = { userId: string; apply: boolean; fromShell: boolean }
// 계정 번호 하나와 --apply, --dry-run(미리 보기를 분명히 적는 것), --from-shell만 받는다. 그 밖은 null이다.
export function parseDemoArgs(args: readonly string[]): DemoArgs | null {
  const flags = args.filter(arg => arg.startsWith('-'))
  const rest = args.filter(arg => !arg.startsWith('-'))
  const [userId, ...extra] = rest
  if (!userId?.trim() || extra.length > 0) return null
  if (!flags.every(flag => ['--apply', '--dry-run', '--from-shell'].includes(flag))) return null
  const apply = flags.includes('--apply')
  if (apply && flags.includes('--dry-run')) return null
  return { userId, apply, fromShell: flags.includes('--from-shell') }
}

const USAGE =
  '사용법: <user-id> [--apply] [--from-shell] (npm run demo --workspace @vada/api -- ...). 아무것도 하지 않았다.'
const SHELL_URL_WITHOUT_FLAG =
  '셸에 DATABASE_URL이 있다. 그 DB에 넣으려면 --from-shell을 붙이고, .env의 DB에 넣으려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.'
const FLAG_WITHOUT_SHELL_URL =
  '--from-shell을 줬지만 셸에 DATABASE_URL이 없다. 아무것도 하지 않았다.'
const NPM_SWALLOWED_DRY_RUN =
  'npm이 --dry-run을 자기 옵션으로 받았다. 플래그 앞에 --를 붙인다. 아무것도 하지 않았다.'
const NO_URL = '.env에 DATABASE_URL이 없다. 아무것도 하지 않았다.'
const PLAN = `시연 학생회('${DEMO_SCHOOL_NAME}')를 넣는다: 그 계정이 회장이고 가상 운영진 7명, 부서 셋, 회계 기간과 예산, 계좌 둘, 행사 셋, 행사·학생회 업무, 전체방 메시지, 구매 요청, 지출을 둔다. 이미 있으면 아무것도 바꾸지 않는다.`
const FAILED =
  '처리 실패. DB 연결, 기존 Google 계정을 확인하세요. 거래 전체가 되돌아가 아무것도 남지 않았습니다. 오류 원문은 출력하지 않습니다.'

export type DemoRun = {
  args: readonly string[]
  env: { readonly npm_config_dry_run?: string | undefined }
  shellUrl: string | undefined
  readEnvUrl: () => string | undefined
  connect: (url: string) => { db: Db; end: () => Promise<void> }
  now: () => Date
  log: { info: (line: string) => void; error: (line: string) => void }
}

// 그대로 붙여 칠 수 있는 적용 명령. npm이 플래그를 가져가지 않게 -- 를 앞에 둔다.
const applyCommandOf = ({ userId, fromShell }: DemoArgs) =>
  `npm run demo --workspace @vada/api -- ${userId}${fromShell ? ' --from-shell' : ''} --apply`

// .env가 없거나 읽을 수 없으면 주소가 없는 것과 같다. 오류 원문은 보이지 않는다.
function envUrlOf(run: DemoRun) {
  try {
    return run.readEnvUrl()?.trim()
  } catch {
    return undefined
  }
}

type Resolved = { stop: string } | { args: DemoArgs; url: string }
function resolve(run: DemoRun): Resolved {
  if (run.env.npm_config_dry_run && run.env.npm_config_dry_run !== 'false')
    return { stop: NPM_SWALLOWED_DRY_RUN }
  const args = parseDemoArgs(run.args)
  if (!args) return { stop: USAGE }
  const source = targetSourceOf(args.fromShell, run.shellUrl)
  if ('stop' in source)
    return {
      stop:
        source.stop === 'SHELL_URL_WITHOUT_FLAG' ? SHELL_URL_WITHOUT_FLAG : FLAG_WITHOUT_SHELL_URL,
    }
  const url = source.source === 'shell' ? source.url : envUrlOf(run)
  return url ? { args, url } : { stop: NO_URL }
}

// 종료 코드를 돌려준다(0이 성공). 인자와 대상이 어긋나면 연결하지 않고 멈춘다. 미리 보기도 연결하지 않는다.
export async function runDemo(run: DemoRun): Promise<number> {
  const resolved = resolve(run)
  if ('stop' in resolved) {
    run.log.error(resolved.stop)
    return 1
  }
  const { args, url } = resolved
  const target = describeTarget(url)
  run.log.info(`대상: ${target} (${args.fromShell ? '셸' : '.env'})`)
  if (!args.apply) {
    run.log.info(`${PLAN} 미리 보기라 바꾸지 않았다. 실제로 하려면: ${applyCommandOf(args)}`)
    return 0
  }
  if (target === UNREADABLE_TARGET) {
    run.log.error(UNSHOWN_TARGET_MESSAGE)
    return 1
  }
  const connection = run.connect(url)
  try {
    const result = await seedDemoCouncil(connection.db, args.userId, run.now())
    run.log.info(
      result === 'created'
        ? `시연 학생회 준비 완료('${DEMO_SCHOOL_NAME}')`
        : `이미 있다('${DEMO_SCHOOL_NAME}'). 아무것도 바꾸지 않았다. 다시 넣으려면 그 학교 이름을 바꾼다.`,
    )
    return 0
  } catch {
    run.log.error(FAILED)
    return 1
  } finally {
    await connection.end().catch(() => {})
  }
}
