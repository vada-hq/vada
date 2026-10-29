import {
  describeTarget,
  UNREADABLE_TARGET,
  UNSHOWN_TARGET_MESSAGE,
} from '../src/ops/migrate/migrate-check.js'
import { databaseUrlOf, NPM_SWALLOWED_DRY_RUN, npmSwallowedDryRun } from '../src/ops/script-args.js'
import type { Db } from '../src/db/types.js'
import type { AccountRole } from '../src/flows/showcase/content/types.js'
import { SHOWCASE } from '../src/flows/showcase/content/index.js'
import { summaryOf } from '../src/flows/showcase/summary.js'
import type { FileStorage } from '../src/storage/storage.js'
import { seedShowcase, type ShowcaseNames } from './showcase-data.js'

// showcase 명령의 판단 전부. manage-showcase.ts는 실제 연결(postgres-js)을 이어 주기만 한다. 시험은 PGlite를 감싼 가짜 connect로 돌린다.
// 인자 규칙은 demo·db:migrate와 같다: 기본은 미리 보기, 실제로 쓰는 것은 --apply뿐이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.

export type ShowcaseArgs = {
  accounts: Partial<Record<AccountRole, string>>
  names: ShowcaseNames
  apply: boolean
  fromShell: boolean
}

// 값을 받는 인자: 역할마다 쓸 실제 계정(users.id)과 이름 둘. 회장 계정만 꼭 있어야 한다(학생회를 만든다).
const ACCOUNT_FLAGS: Record<string, AccountRole> = {
  '--president': 'president',
  '--finance-head': 'financeHead',
  '--planning-head': 'planningHead',
}
const NAME_FLAGS: Record<string, keyof ShowcaseNames> = {
  '--school': 'schoolName',
  '--council': 'name',
}
const SWITCHES = ['--apply', '--dry-run', '--from-shell']
const ROLE_LABELS: Record<AccountRole, string> = {
  president: '회장',
  financeHead: '재정부장',
  planningHead: '기획부장',
}

type Collected = { values: Map<string, string>; switches: Set<string> }
// 값 인자는 '--이름 값' 꼴이고 같은 인자를 두 번 주지 않는다. 모르는 인자나 빈 값은 null이다.
function collect(args: readonly string[]): Collected | null {
  const values = new Map<string, string>()
  const switches = new Set<string>()
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (SWITCHES.includes(arg) && !switches.has(arg)) {
      switches.add(arg)
      continue
    }
    const value = args[index + 1]?.trim()
    const known = arg in ACCOUNT_FLAGS || arg in NAME_FLAGS
    if (!known || values.has(arg) || !value || value.startsWith('--')) return null
    values.set(arg, value)
    index++
  }
  return { values, switches }
}

export function parseShowcaseArgs(args: readonly string[]): ShowcaseArgs | null {
  const collected = collect(args)
  if (!collected) return null
  const { values, switches } = collected
  const apply = switches.has('--apply')
  if (apply && switches.has('--dry-run')) return null
  const accounts: ShowcaseArgs['accounts'] = {}
  for (const [flag, role] of Object.entries(ACCOUNT_FLAGS)) {
    const userId = values.get(flag)
    if (userId) accounts[role] = userId
  }
  if (!accounts.president) return null
  const ids = Object.values(accounts)
  if (new Set(ids).size !== ids.length) return null
  const names: ShowcaseNames = {
    schoolName: values.get('--school') ?? SHOWCASE.council.schoolName,
    name: values.get('--council') ?? SHOWCASE.council.name,
  }
  return { accounts, names, apply, fromShell: switches.has('--from-shell') }
}

const USAGE =
  "사용법: --president <user-id> [--finance-head <user-id>] [--planning-head <user-id>] [--school '<학교 이름>'] [--council '<학생회 이름>'] [--apply] [--from-shell] (pnpm --filter @vada/api showcase ...). 아무것도 하지 않았다."
const NO_STORAGE =
  '증빙 저장소가 없어 영수증을 붙일 수 없다. R2 설정(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)을 .env나 셸에 준다. 아무것도 하지 않았다.'
const FAILED =
  '처리 실패. DB 연결과 계정(Google로 로그인한 적 있는 users.id인지)을 확인하세요. 거래 전체가 되돌아가 아무것도 남지 않았습니다. 오류 원문은 출력하지 않습니다.'

export type ShowcaseRun = {
  args: readonly string[]
  env: { readonly npm_config_dry_run?: string | undefined }
  shellUrl: string | undefined
  readEnvUrl: () => string | undefined
  connect: (url: string) => { db: Db; end: () => Promise<void> }
  storage: FileStorage | null
  fetcher?: typeof fetch
  now: () => Date
  log: { info: (line: string) => void; error: (line: string) => void }
}

const quoted = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
// 그대로 붙여 칠 수 있는 적용 명령
function applyCommandOf({ accounts, names, fromShell }: ShowcaseArgs) {
  const parts = ['pnpm --filter @vada/api showcase']
  for (const [flag, role] of Object.entries(ACCOUNT_FLAGS))
    if (accounts[role]) parts.push(`${flag} ${accounts[role]}`)
  parts.push(`--school ${quoted(names.schoolName)} --council ${quoted(names.name)}`)
  if (fromShell) parts.push('--from-shell')
  return [...parts, '--apply'].join(' ')
}

// 무엇을 만들지. 계정은 자리 이름만 보이고 이름·이메일은 찍지 않는다.
function planOf({ accounts, names }: ShowcaseArgs, now: Date) {
  const roles = Object.entries(ROLE_LABELS) as [AccountRole, string][]
  const real = roles.filter(([role]) => accounts[role]).map(([, label]) => label)
  const virtual = roles.filter(([role]) => !accounts[role]).map(([, label]) => label)
  return [
    `만들 학생회: '${names.schoolName}' '${names.name}'`,
    `실제 계정 자리: ${real.join(', ')}${virtual.length ? ` / 가상 인물이 맡는 자리: ${virtual.join(', ')}` : ''}`,
    `내용: ${summaryOf(SHOWCASE)}. 날짜는 돌리는 때(${now.toISOString()}) 기준이다.`,
  ]
}

type Resolved = { stop: string } | { args: ShowcaseArgs; url: string }
function resolve(run: ShowcaseRun): Resolved {
  if (npmSwallowedDryRun(run.env)) return { stop: NPM_SWALLOWED_DRY_RUN }
  const args = parseShowcaseArgs(run.args)
  if (!args) return { stop: USAGE }
  const target = databaseUrlOf(args.fromShell, run.shellUrl, run.readEnvUrl)
  return 'stop' in target ? target : { args, url: target.url }
}

// 연결해 한 거래로 만든다. 실패하면 오류 원문을 찍지 않는다(DB 값이나 사람 이름이 섞일 수 있다).
async function applyShowcase(
  run: ShowcaseRun,
  { args, url, now }: { args: ShowcaseArgs; url: string; now: Date },
  storage: FileStorage,
) {
  const connection = run.connect(url)
  try {
    const result = await seedShowcase(
      connection.db,
      { names: args.names, accounts: args.accounts, now },
      { storage, ...(run.fetcher ? { fetcher: run.fetcher } : {}) },
    )
    run.log.info(
      result === 'created'
        ? '시연 학생회 준비 완료'
        : '같은 학교에 같은 이름의 학생회가 이미 있다. 아무것도 바꾸지 않았다. --council로 다른 이름을 준다.',
    )
    return result === 'created' ? 0 : 1
  } catch {
    run.log.error(FAILED)
    return 1
  } finally {
    await connection.end().catch(() => {})
  }
}

// 종료 코드를 돌려준다(0이 성공). 인자와 대상이 어긋나면 연결하지 않고 멈춘다. 미리 보기도 연결하지 않는다.
export async function runShowcaseCommand(run: ShowcaseRun): Promise<number> {
  const resolved = resolve(run)
  if ('stop' in resolved) {
    run.log.error(resolved.stop)
    return 1
  }
  const { args, url } = resolved
  const target = describeTarget(url)
  run.log.info(`대상: ${target} (${args.fromShell ? '셸' : '.env'})`)
  if (!run.storage) {
    run.log.error(NO_STORAGE)
    return 1
  }
  const now = run.now()
  for (const line of planOf(args, now)) run.log.info(line)
  if (!args.apply) {
    run.log.info(`미리 보기라 바꾸지 않았다. 실제로 하려면: ${applyCommandOf(args)}`)
    return 0
  }
  if (target === UNREADABLE_TARGET) {
    run.log.error(UNSHOWN_TARGET_MESSAGE)
    return 1
  }
  return applyShowcase(run, { args, url, now }, run.storage)
}
