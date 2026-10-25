import {
  describeTarget,
  UNREADABLE_TARGET,
  UNSHOWN_TARGET_MESSAGE,
} from '../src/ops/migrate/migrate-check.js'
import { databaseUrlOf, NPM_SWALLOWED_DRY_RUN, npmSwallowedDryRun } from '../src/ops/script-args.js'
import type { Db } from '../src/db/types.js'
import { ApiError } from '../src/http/errors.js'
import {
  previewWithdrawal,
  userIdByEmail,
  withdrawAccount,
  type WithdrawalCounts,
} from '../src/withdrawal/service.js'

// privacy 명령의 판단 전부(기능 021). manage-privacy.ts는 실제 연결(postgres-js)을 이어 주기만 한다. 시험은 PGlite를 감싼 가짜 connect로 돌린다.
// 인자 규칙은 db:migrate·demo와 같다: 기본은 미리 보기, 실제로 쓰는 것은 --apply뿐이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.
// 미리 보기도 개수를 세려고 연결한다. 출력에는 대상(호스트·DB 이름)과 개수만 있다. 이메일·이름·번호는 찍지 않는다(DEC-56, AGENTS.md '로그·비밀').
// 지금 하는 일: withdraw --email <가입 이메일>. 이메일로 온 탈퇴 요청과 만 14세 미만 정리를 앱의 탈퇴와 같은 서비스로 한다(처리방침 6조 ④, 2조, DEC-72).
// 본인 확인은 사람이 먼저 한다(DEC-72). 회장 막기는 앱과 같고, 다시 로그인 검사만 없다.

const EMAIL_MAX = 320
const isEmail = (value: string) => value.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+$/.test(value)

export type PrivacyArgs = { command: 'withdraw'; email: string; apply: boolean; fromShell: boolean }
const FLAGS = ['--apply', '--dry-run', '--from-shell']
// withdraw --email <이메일>과 --apply, --dry-run(미리 보기를 분명히 적는 것), --from-shell만 받는다. 그 밖은 null이다.
export function parsePrivacyArgs(args: readonly string[]): PrivacyArgs | null {
  const [command, ...rest] = args
  if (command !== 'withdraw') return null
  const at = rest.indexOf('--email')
  const email = at >= 0 ? rest[at + 1] : undefined
  if (!email || !isEmail(email)) return null
  const flags = rest.filter((_, index) => index !== at && index !== at + 1)
  if (!flags.every(flag => FLAGS.includes(flag)) || new Set(flags).size !== flags.length)
    return null
  const apply = flags.includes('--apply')
  if (apply && flags.includes('--dry-run')) return null
  return { command, email, apply, fromShell: flags.includes('--from-shell') }
}

const USAGE =
  '사용법: withdraw --email <가입 이메일> [--apply] [--from-shell] (pnpm --filter @vada/api privacy ...). 아무것도 하지 않았다.'
const NO_ACCOUNT = '그 이메일로 가입한 계정이 없다. 아무것도 바꾸지 않았다.'
const PRESIDENT =
  '어느 학생회든 지금 기수의 회장이다. 회장 직급을 넘긴 뒤에 탈퇴할 수 있다(혼자 남은 회장은 학생회 그만두기를 거친다). 아무것도 바꾸지 않았다.'
const FAILED =
  '처리 실패. DB 연결을 확인하세요. 거래 전체가 되돌아가 아무것도 바뀌지 않았습니다. 오류 원문은 출력하지 않습니다.'

export type PrivacyRun = {
  args: readonly string[]
  env: { readonly npm_config_dry_run?: string | undefined }
  shellUrl: string | undefined
  readEnvUrl: () => string | undefined
  connect: (url: string) => { db: Db; end: () => Promise<void> }
  now: () => Date
  log: { info: (line: string) => void; error: (line: string) => void }
}

const countsLine = (counts: WithdrawalCounts) =>
  `계정 1, 학생회 소속 ${counts.councilMemberships}, 부서 소속 ${counts.departmentMemberships}, 운영진 판 ${counts.memberVersions}, 알림 기기 ${counts.devices}, 세션 ${counts.sessions}`

type Outcome = { code: number; line: string; error?: true }

async function preview(db: Db, email: string, now: Date): Promise<Outcome> {
  const userId = await userIdByEmail(db, email)
  if (!userId) return { code: 1, line: NO_ACCOUNT, error: true }
  const found = await previewWithdrawal(db, userId, now)
  if (found.president) return { code: 1, line: PRESIDENT, error: true }
  return {
    code: 0,
    line: `탈퇴할 것: ${countsLine(found.counts)}. 미리 보기라 바꾸지 않았다. 실제로 하려면 같은 명령에 --apply를 붙인다.`,
  }
}

// 앱의 탈퇴와 같은 거래 하나다. 회장이면 서비스가 409로 멈추고 거래가 되돌아간다.
async function apply(db: Db, email: string, now: Date): Promise<Outcome> {
  try {
    const counts = await db.transaction(async tx => {
      const userId = await userIdByEmail(tx, email)
      return userId ? withdrawAccount(tx, userId, now) : null
    })
    if (!counts) return { code: 1, line: NO_ACCOUNT, error: true }
    return { code: 0, line: `탈퇴 완료: ${countsLine(counts)}` }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PRESIDENT_CANNOT_WITHDRAW')
      return { code: 1, line: PRESIDENT, error: true }
    throw error
  }
}

type Resolved = { stop: string } | { args: PrivacyArgs; url: string; source: string }
function resolve(run: PrivacyRun): Resolved {
  if (npmSwallowedDryRun(run.env)) return { stop: NPM_SWALLOWED_DRY_RUN }
  const args = parsePrivacyArgs(run.args)
  if (!args) return { stop: USAGE }
  const target = databaseUrlOf(args.fromShell, run.shellUrl, run.readEnvUrl)
  return 'stop' in target ? target : { args, ...target }
}

// 종료 코드를 돌려준다(0이 성공). 인자와 대상이 어긋나거나 대상을 보일 수 없으면 연결하지 않고 멈춘다.
export async function runPrivacy(run: PrivacyRun): Promise<number> {
  const resolved = resolve(run)
  if ('stop' in resolved) {
    run.log.error(resolved.stop)
    return 1
  }
  const { args, url, source } = resolved
  const target = describeTarget(url)
  run.log.info(`대상: ${target} (${source})`)
  if (target === UNREADABLE_TARGET) {
    run.log.error(UNSHOWN_TARGET_MESSAGE)
    return 1
  }
  const connection = run.connect(url)
  try {
    const outcome = await (args.apply ? apply : preview)(connection.db, args.email, run.now())
    if (outcome.error) run.log.error(outcome.line)
    else run.log.info(outcome.line)
    return outcome.code
  } catch {
    run.log.error(FAILED)
    return 1
  } finally {
    await connection.end().catch(() => {})
  }
}
