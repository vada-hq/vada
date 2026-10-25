import { isUuid, koreanDate, koreanOf } from '@vada/contracts'
import {
  describeTarget,
  targetSourceOf,
  UNREADABLE_TARGET,
  UNSHOWN_TARGET_MESSAGE,
} from '../src/ops/migrate/migrate-check.js'
import type { Db } from '../src/db/types.js'
import {
  inspectRecovery,
  objectionEndsAt,
  recoverPresident,
  type RecoveryInput,
  type RecoveryProblem,
  type RecoveryView,
} from './president-recovery.js'

// president-recovery 명령의 판단 전부. manage-president-recovery.ts는 실제 연결(postgres-js)을 이어 주기만 한다. 시험은 PGlite를 감싼 가짜 connect로 돌린다.
// 인자와 대상 규칙은 db:migrate, demo와 같다: 기본은 미리 보기, 실제로 쓰는 것은 --apply뿐이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.
// 미리 보기도 학생회와 두 회장을 보이려고 연결해 읽는다(쓰지 않는다).

export type RecoveryArgs = {
  councilId: string
  email: string
  notifiedOn: string
  apply: boolean
  fromShell: boolean
}

const NOTIFIED_ON = '--notified-on'
const SWITCHES = ['--apply', '--from-shell']
const EMAIL = /^[^\s@]+@[^\s@]+$/
const EMAIL_MAX = 254

// '--notified-on 날짜'를 꺼내고 남은 인자를 돌려준다. 없거나 둘이거나 날짜가 아니면 null이다.
function notifiedOnOf(args: readonly string[]) {
  const at = args.indexOf(NOTIFIED_ON)
  if (at < 0 || args.lastIndexOf(NOTIFIED_ON) !== at) return null
  const value = args[at + 1]
  if (!value || !koreanDate.safeParse(value).success) return null
  return { notifiedOn: value, rest: args.filter((_, index) => index !== at && index !== at + 1) }
}

// 학생회 번호, 이메일, --notified-on 날짜 하나와 --apply, --from-shell만 받는다. 그 밖(모르는 플래그, 남는 낱말, 틀린 형식)은 null이다.
export function parseRecoveryArgs(args: readonly string[]): RecoveryArgs | null {
  const found = notifiedOnOf(args)
  if (!found) return null
  const flags = found.rest.filter(arg => arg.startsWith('-'))
  const words = found.rest.filter(arg => !arg.startsWith('-'))
  if (!flags.every(flag => SWITCHES.includes(flag))) return null
  const [councilId, email, ...extra] = words
  if (extra.length || !councilId || !isUuid(councilId)) return null
  if (!email || email.length > EMAIL_MAX || !EMAIL.test(email)) return null
  return {
    councilId: councilId.toLowerCase(),
    email,
    notifiedOn: found.notifiedOn,
    apply: flags.includes('--apply'),
    fromShell: flags.includes('--from-shell'),
  }
}

const USAGE =
  '사용법: <학생회 id> <새 회장 이메일> --notified-on <YYYY-MM-DD> [--apply] [--from-shell] (pnpm --filter @vada/api president-recovery ...). 아무것도 하지 않았다.'
const SHELL_URL_WITHOUT_FLAG =
  '셸에 DATABASE_URL이 있다. 그 DB에 하려면 --from-shell을 붙이고, .env의 DB에 하려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.'
const FLAG_WITHOUT_SHELL_URL =
  '--from-shell을 줬지만 셸에 DATABASE_URL이 없다. 아무것도 하지 않았다.'
const NPM_SWALLOWED_DRY_RUN =
  'npm이 --dry-run을 자기 옵션으로 받았다. pnpm으로 돌린다. 아무것도 하지 않았다.'
const NO_URL = '.env에 DATABASE_URL이 없다. 아무것도 하지 않았다.'
const UNSHOWN_TARGET = UNSHOWN_TARGET_MESSAGE.replace('적용하지 않는다', '연결하지 않는다')
const FAILED =
  '처리 실패. DB 연결을 확인하세요. 거래 전체가 되돌아가 아무것도 바뀌지 않았습니다. 오류 원문은 출력하지 않습니다.'

const PROBLEM_MESSAGES: Record<Exclude<RecoveryProblem, 'TOO_EARLY'>, string> = {
  NO_COUNCIL: '그 번호의 학생회가 없다.',
  NO_COHORT: '그 학생회에 지금 기수가 없다.',
  NO_PRESIDENT: '그 학생회 지금 기수에 회장이 없다.',
  NO_ACCOUNT: '그 이메일의 계정이 없다.',
  NOT_MEMBER: '새 회장이 그 학생회 지금 기수 운영진이 아니다(다른 학생회 사람이거나 내보낸 사람).',
  ALREADY_PRESIDENT: '새 회장이 이미 회장이다.',
}

export type RecoveryRun = {
  args: readonly string[]
  env: { readonly npm_config_dry_run?: string | undefined }
  shellUrl: string | undefined
  readEnvUrl: () => string | undefined
  connect: (url: string) => { db: Db; end: () => Promise<void> }
  now: () => Date
  log: { info: (line: string) => void; error: (line: string) => void }
}

// 그대로 붙여 칠 수 있는 적용 명령
const applyCommandOf = (args: RecoveryArgs) =>
  `pnpm --filter @vada/api president-recovery ${args.councilId} ${args.email} ${NOTIFIED_ON} ${args.notifiedOn}${args.fromShell ? ' --from-shell' : ''} --apply`

// 이의 기간 한 줄. 끝 시각은 한국 시각으로 보인다(알린 날 + 7일의 24:00 = 그다음 날 00:00).
function objectionLineOf(notifiedOn: string, now: Date) {
  const ends = objectionEndsAt(notifiedOn)
  const lastDay = koreanOf(new Date(ends.getTime() - 1)).slice(0, notifiedOn.length)
  return now < ends
    ? `이의 기간이 끝나지 않았다: ${notifiedOn}에 알림, ${lastDay} 24:00(한국)까지.`
    : `이의 기간 끝남: ${notifiedOn}에 알림, ${lastDay} 24:00(한국)까지.`
}

// .env가 없거나 읽을 수 없으면 주소가 없는 것과 같다. 오류 원문은 보이지 않는다.
function envUrlOf(run: RecoveryRun) {
  try {
    return run.readEnvUrl()?.trim()
  } catch {
    return undefined
  }
}

type Resolved = { stop: string } | { args: RecoveryArgs; url: string }
function resolve(run: RecoveryRun): Resolved {
  if (run.env.npm_config_dry_run && run.env.npm_config_dry_run !== 'false')
    return { stop: NPM_SWALLOWED_DRY_RUN }
  const args = parseRecoveryArgs(run.args)
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

// 학생회, 두 회장, 점검에 걸린 것을 찍는다. 걸린 것이 있으면 false다.
function report(run: RecoveryRun, args: RecoveryArgs, input: RecoveryInput, view: RecoveryView) {
  if (view.councilName) run.log.info(`학생회: ${view.councilName}`)
  if (view.current) run.log.info(`지금 회장: ${view.current.name}`)
  if (view.next) run.log.info(`새 회장: ${view.next.name} (${args.email})`)
  const objection = objectionLineOf(args.notifiedOn, input.now)
  for (const problem of view.problems)
    run.log.error(problem === 'TOO_EARLY' ? objection : PROBLEM_MESSAGES[problem])
  if (view.problems.length) {
    run.log.error('점검에 걸려 아무것도 하지 않았다.')
    return false
  }
  run.log.info(objection)
  return true
}

async function inspectOrApply(run: RecoveryRun, args: RecoveryArgs, db: Db, now: Date) {
  const input = { councilId: args.councilId, email: args.email, notifiedOn: args.notifiedOn, now }
  const view = await (args.apply ? recoverPresident(db, input) : inspectRecovery(db, input))
  if (!report(run, args, input, view)) return 1
  run.log.info(
    args.apply
      ? `회장 옮김 완료: ${view.current?.name} → ${view.next?.name}`
      : `점검 통과. 미리 보기라 바꾸지 않았다. 실제로 하려면: ${applyCommandOf(args)}`,
  )
  return 0
}

// 종료 코드를 돌려준다(0이 성공). 인자와 대상이 어긋나면 연결하지 않고 멈춘다. 적용인데 이의 기간이 남았으면 연결하지 않고 멈춘다.
export async function runPresidentRecovery(run: RecoveryRun): Promise<number> {
  const resolved = resolve(run)
  if ('stop' in resolved) {
    run.log.error(resolved.stop)
    return 1
  }
  const { args, url } = resolved
  const target = describeTarget(url)
  run.log.info(`대상: ${target} (${args.fromShell ? '셸' : '.env'})`)
  if (target === UNREADABLE_TARGET) {
    run.log.error(UNSHOWN_TARGET)
    return 1
  }
  const now = run.now()
  if (args.apply && now < objectionEndsAt(args.notifiedOn)) {
    run.log.error(`${objectionLineOf(args.notifiedOn, now)} 아무것도 하지 않았다.`)
    return 1
  }
  const connection = run.connect(url)
  try {
    return await inspectOrApply(run, args, connection.db, now)
  } catch {
    run.log.error(FAILED)
    return 1
  } finally {
    await connection.end().catch(() => {})
  }
}
