import {
  describeTarget,
  UNREADABLE_TARGET,
  UNSHOWN_TARGET_MESSAGE,
} from '../src/ops/migrate/migrate-check.js'
import { databaseUrlOf, NPM_SWALLOWED_DRY_RUN, npmSwallowedDryRun } from '../src/ops/script-args.js'
import type { Db } from '../src/db/types.js'
import { ApiError } from '../src/http/errors.js'
import type { FileStorage } from '../src/storage/storage.js'
import {
  previewWithdrawal,
  userIdByEmail,
  withdrawAccount,
  type WithdrawalCounts,
} from '../src/withdrawal/service.js'
import { flagsOf, isEmail, optionsOf, type Flags, type Outcome } from './privacy-args.js'
import {
  applyErase,
  NO_EXPECT,
  NO_STORAGE,
  parseEraseArgs,
  previewErase,
  type EraseArgs,
} from './privacy-erase.js'

// privacy 명령의 판단 전부(기능 021). manage-privacy.ts는 실제 연결(postgres-js)을 이어 주기만 한다. 시험은 PGlite를 감싼 가짜 connect로 돌린다.
// 인자 규칙은 db:migrate·demo와 같다: 기본은 미리 보기, 실제로 쓰는 것은 --apply뿐이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.
// 미리 보기도 개수를 세려고 연결한다. 출력에는 대상(호스트·DB 이름)과 개수만 있다. 이메일·이름·번호는 찍지 않는다(DEC-56, AGENTS.md '로그·비밀').
// 하는 일: withdraw --email <가입 이메일>. 이메일로 온 탈퇴 요청과 만 14세 미만 정리를 앱의 탈퇴와 같은 서비스로 한다(처리방침 6조 ④, 2조, DEC-72).
// 본인 확인은 사람이 먼저 한다(DEC-72). 회장 막기는 앱과 같고, 다시 로그인 검사만 없다.
// erase-messages: 학생회의 요청으로 메시지와 사진을 지운다(DEC-88, privacy-erase.ts).

type WithdrawArgs = Flags & { command: 'withdraw'; email: string }
export type PrivacyArgs = WithdrawArgs | EraseArgs

function parseWithdrawArgs(rest: readonly string[]): WithdrawArgs | null {
  const options = optionsOf(rest, ['--email'])
  const email = options?.values.get('--email')
  const flags = options && flagsOf(options.flags)
  if (!email || !isEmail(email) || !flags) return null
  return { command: 'withdraw', email, ...flags }
}

// withdraw --email <이메일>, erase-messages(privacy-erase.ts)와 --apply, --dry-run, --from-shell만 받는다. 그 밖은 null이다.
export function parsePrivacyArgs(args: readonly string[]): PrivacyArgs | null {
  const [command, ...rest] = args
  if (command === 'withdraw') return parseWithdrawArgs(rest)
  return command === 'erase-messages' ? parseEraseArgs(rest) : null
}

const USAGE =
  '사용법: withdraw --email <가입 이메일> [--apply] [--from-shell], erase-messages --invite <초대 코드> (--sender <이메일> | --left <N>) --from <YYYY-MM-DDTHH:MM> --to <YYYY-MM-DDTHH:MM> [--expect <개수>] [--apply] [--from-shell] (한국 시각, pnpm --filter @vada/api privacy ...). 아무것도 하지 않았다.'
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
  // 사진 저장소(R2). erase-messages만 쓰고, 없으면 연결하기 전에 멈춘다.
  storage?: () => FileStorage | null
  now: () => Date
  log: { info: (line: string) => void; error: (line: string) => void }
}

const countsLine = (counts: WithdrawalCounts) =>
  `계정 1, 학생회 소속 ${counts.councilMemberships}, 부서 소속 ${counts.departmentMemberships}, 운영진 판 ${counts.memberVersions}, 알림 기기 ${counts.devices}, 세션 ${counts.sessions}`

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

type Work = (db: Db) => Promise<Outcome>
type Resolved = { stop: string } | { args: PrivacyArgs; work: Work; url: string; source: string }

// 할 일을 고른다. erase-messages는 --apply에 --expect가 없거나 저장소가 없으면 연결하기 전에 멈춘다.
function workOf(run: PrivacyRun, args: PrivacyArgs): Work | { stop: string } {
  if (args.command === 'withdraw')
    return db => (args.apply ? apply : preview)(db, args.email, run.now())
  if (args.apply && args.expect === null) return { stop: NO_EXPECT }
  const storage = run.storage?.() ?? null
  if (!storage) return { stop: NO_STORAGE }
  return db => (args.apply ? applyErase(db, storage, args) : previewErase(db, args))
}

function resolve(run: PrivacyRun): Resolved {
  if (npmSwallowedDryRun(run.env)) return { stop: NPM_SWALLOWED_DRY_RUN }
  const args = parsePrivacyArgs(run.args)
  if (!args) return { stop: USAGE }
  const work = workOf(run, args)
  if ('stop' in work) return work
  const target = databaseUrlOf(args.fromShell, run.shellUrl, run.readEnvUrl)
  return 'stop' in target ? target : { args, work, ...target }
}

// 종료 코드를 돌려준다(0이 성공). 인자와 대상이 어긋나거나 대상을 보일 수 없으면 연결하지 않고 멈춘다.
export async function runPrivacy(run: PrivacyRun): Promise<number> {
  const resolved = resolve(run)
  if ('stop' in resolved) {
    run.log.error(resolved.stop)
    return 1
  }
  const { work, url, source } = resolved
  const target = describeTarget(url)
  run.log.info(`대상: ${target} (${source})`)
  if (target === UNREADABLE_TARGET) {
    run.log.error(UNSHOWN_TARGET_MESSAGE)
    return 1
  }
  const connection = run.connect(url)
  try {
    const outcome = await work(connection.db)
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
