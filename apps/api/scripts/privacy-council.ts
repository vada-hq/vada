import { eq } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import { lockCouncil } from '../src/access/authorize.js'
import { clearClosing, destroyableFrom, markClosing } from '../src/councils/closing.js'
import { destroyCouncilRows, destroyPlanOf, type DestroyPlan } from '../src/councils/destroy.js'
import { council, inviteCode } from '../src/db/schema.js'
import type { Db, Tx } from '../src/db/types.js'
import type { FileStorage } from '../src/storage/storage.js'
import {
  flagsOf,
  inviteOf,
  optionsOf,
  wholeNumber,
  type Flags,
  type Outcome,
} from './privacy-args.js'

// privacy council-close·council-reopen·council-destroy(기능 021 정한 것 15, DEC-55, DEC-72): 학생회 그만두기.
// 학생회가 이메일로 알리면 표시하고(읽기만 됨), 이어 쓰면 표시를 지우고, 표시한 날부터 30일이 지났거나 학생회가 바로 지워 달라고 했으면(--now) 파기한다.
// 학생회는 초대 코드로 가린다(학생회 번호나 이름을 DB에서 찾아보지 않으려는 것이다). 출력은 개수와 날짜뿐이다(DEC-56).
// 파기의 --apply는 --expect가 미리 보기의 기록 수와 같을 때만 쓴다. 차례: 저장소 객체를 지우고, 그다음 한 거래로 그 학생회의 행을 모두 지운다.
// 거래가 실패해도 다시 돌리면 끝까지 간다(이미 지운 객체는 저장소가 성공으로 본다).

type CouncilCommand = 'council-close' | 'council-reopen' | 'council-destroy'
type MarkArgs = Flags & { command: 'council-close' | 'council-reopen'; invite: string }
type DestroyArgs = Flags & {
  command: 'council-destroy'
  invite: string
  now: boolean
  expect: number | null
}
export type CouncilArgs = MarkArgs | DestroyArgs
export const COUNCIL_COMMANDS: readonly string[] = [
  'council-close',
  'council-reopen',
  'council-destroy',
] satisfies CouncilCommand[]

const EXPECT_MAX = 100_000_000
const NOW_FLAG = '--now'

// 파기만 --now와 --expect를 받는다. 틀리면 null이다.
export function parseCouncilArgs(command: string, rest: readonly string[]): CouncilArgs | null {
  const destroy = command === 'council-destroy'
  const options = optionsOf(rest, destroy ? ['--invite', '--expect'] : ['--invite'])
  if (!options) return null
  const nowFlags = options.flags.filter(flag => flag === NOW_FLAG)
  const flags = flagsOf(options.flags.filter(flag => flag !== NOW_FLAG))
  const invite = inviteOf(options.values.get('--invite'))
  if (!flags || !invite || nowFlags.length > (destroy ? 1 : 0)) return null
  if (!destroy) return { command: command as MarkArgs['command'], invite, ...flags }
  const expect = expectOf(options.values)
  if (expect === undefined) return null
  return { command, invite, now: nowFlags.length === 1, expect, ...flags }
}

// --expect가 없으면 null, 있는데 틀리면 undefined다.
const expectOf = (values: Map<string, string>) =>
  values.has('--expect') ? (wholeNumber(values.get('--expect'), 0, EXPECT_MAX) ?? undefined) : null

const NO_COUNCIL = '그 초대 코드의 학생회가 없다. 아무것도 바꾸지 않았다.'
const NOT_MARKED =
  '그만두기로 표시하지 않은 학생회다. 먼저 council-close로 표시한다. 아무것도 바꾸지 않았다.'
const NO_DESTROY_EXPECT =
  '--apply에는 미리 보기의 기록 수를 --expect <기록 수>로 함께 준다. 아무것도 하지 않았다.'
const STORAGE_FAILED =
  '저장소에서 객체를 지우지 못했다. DB는 바꾸지 않았다. 같은 명령을 다시 돌리면 이어서 지운다. 오류 원문은 출력하지 않는다.'
const CHANGED =
  '미리 보기 뒤에 지울 것이 바뀌었다. 저장소 객체는 이미 지웠고 DB는 바꾸지 않았다. 미리 보기를 다시 보고 새 개수로 다시 돌리면 이어서 지운다.'
const PREVIEW = '미리 보기라 바꾸지 않았다.'
const stop = (line: string): Outcome => ({ code: 1, line, error: true })
const done = (line: string): Outcome => ({ code: 0, line })
const dueDayOf = (closingAt: Date) => `${koreanDateOf(destroyableFrom(closingAt))}(한국)`

async function councilOf(db: Pick<Db, 'select'>, invite: string) {
  const [found] = await db
    .select({ id: council.id, closingAt: council.closingRequestedAt })
    .from(inviteCode)
    .innerJoin(council, eq(council.id, inviteCode.councilId))
    .where(eq(inviteCode.code, invite))
  return found ?? null
}

// 미리 보기는 읽기만 한다. --apply는 같은 거래에서 학생회 행을 잠근 뒤 다시 보므로 겹친 바꾸기는 표시 전이나 뒤에 줄을 선다.
async function mark(db: Db, args: MarkArgs, now: Date): Promise<Outcome> {
  return db.transaction(async tx => {
    const first = await councilOf(tx, args.invite)
    if (!first) return stop(NO_COUNCIL)
    if (args.apply) await lockCouncil(tx, first.id)
    const { id, closingAt } = (args.apply ? await councilOf(tx, args.invite) : first) ?? first
    return args.command === 'council-close'
      ? closeCouncil(tx, { id, closingAt, apply: args.apply, now })
      : reopenCouncil(tx, { id, closingAt, apply: args.apply })
  })
}

type Marking = { id: string; closingAt: Date | null; apply: boolean }

async function closeCouncil(tx: Tx, { id, closingAt, apply, now }: Marking & { now: Date }) {
  if (closingAt)
    return done(`이미 그만두기로 표시돼 있다(파기는 ${dueDayOf(closingAt)}부터). 바꾸지 않았다.`)
  if (!apply)
    return done(
      `그만두기 표시할 것: 학생회 1. 파기는 ${dueDayOf(now)}부터 된다. ${PREVIEW} 실제로 하려면 같은 명령에 --apply를 붙인다.`,
    )
  await markClosing(tx, id, now)
  return done(`그만두기 표시함: 학생회 1. 파기는 ${dueDayOf(now)}부터 된다.`)
}

async function reopenCouncil(tx: Tx, { id, closingAt, apply }: Marking) {
  if (!closingAt) return done('그만두기로 표시돼 있지 않다. 바꾸지 않았다.')
  if (!apply)
    return done(
      `이어 쓰기: 학생회 1의 그만두기 표시를 지운다. ${PREVIEW} 실제로 하려면 같은 명령에 --apply를 붙인다.`,
    )
  await clearClosing(tx, id)
  return done('이어 쓰기 완료: 학생회 1. 다시 쓸 수 있다.')
}

const tablesLine = (plan: DestroyPlan) =>
  [
    ...plan.tables.filter(item => item.rows > 0).map(item => `${item.table} ${item.rows}`),
    `저장소 객체 ${new Set(plan.storageKeys).size}`,
  ].join(', ')
const keptLine = (plan: DestroyPlan) =>
  `남길 것: 운영진 ${plan.kept.members}(로그인이나 다른 학생회 소속이 있음), 신청자 열람 기록 ${plan.kept.accessLogs}.`

// 파기할 수 있는 학생회인가: 표시했고, 30일이 지났거나 --now다. 맞으면 학생회 번호다.
async function destroyable(db: Pick<Db, 'select'>, args: DestroyArgs, now: Date) {
  const found = await councilOf(db, args.invite)
  if (!found) return { stop: NO_COUNCIL }
  if (!found.closingAt) return { stop: NOT_MARKED }
  if (!args.now && now.getTime() < destroyableFrom(found.closingAt).getTime())
    return {
      stop: `표시한 날부터 30일이 지나지 않았다(파기는 ${dueDayOf(found.closingAt)}부터). 학생회가 바로 지워 달라고 했으면 --now를 붙인다. 아무것도 바꾸지 않았다.`,
    }
  return { councilId: found.id }
}

async function previewDestroy(db: Db, args: DestroyArgs, now: Date): Promise<Outcome> {
  const target = await destroyable(db, args, now)
  if ('stop' in target) return stop(target.stop)
  const plan = await destroyPlanOf(db, target.councilId)
  return done(
    `지울 것: ${tablesLine(plan)}. ${keptLine(plan)} ${PREVIEW} 실제로 하려면 같은 명령에 --expect ${plan.records} --apply를 붙인다.`,
  )
}

class Changed extends Error {}
const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

async function applyDestroy(
  db: Db,
  storage: FileStorage,
  args: DestroyArgs,
  now: Date,
): Promise<Outcome> {
  const target = await destroyable(db, args, now)
  if ('stop' in target) return stop(target.stop)
  const plan = await destroyPlanOf(db, target.councilId)
  if (plan.records !== args.expect)
    return stop(
      `지울 기록이 ${plan.records}개라 --expect ${args.expect}와 다르다. 아무것도 바꾸지 않았다.`,
    )
  try {
    for (const key of new Set(plan.storageKeys)) await storage.remove(key)
  } catch {
    return stop(STORAGE_FAILED)
  }
  try {
    await db.transaction(async tx => {
      await lockCouncil(tx, target.councilId)
      const again = await destroyable(tx, args, now)
      if ('stop' in again) throw new Changed()
      if (!sameIds((await destroyPlanOf(tx, target.councilId)).ids, plan.ids)) throw new Changed()
      await destroyCouncilRows(tx, plan)
    })
  } catch (error) {
    if (error instanceof Changed) return stop(CHANGED)
    throw error
  }
  return done(`파기함: ${tablesLine(plan)}. ${keptLine(plan)}`)
}

type CouncilWork = (db: Db) => Promise<Outcome>

// 할 일을 고른다. 파기는 --apply에 --expect가 없거나 저장소가 없으면 연결하기 전에 멈춘다.
export function councilWorkOf(
  args: CouncilArgs,
  now: Date,
  storage: (() => FileStorage | null) | undefined,
  noStorage: string,
): CouncilWork | { stop: string } {
  if (args.command !== 'council-destroy') return db => mark(db, args, now)
  if (args.apply && args.expect === null) return { stop: NO_DESTROY_EXPECT }
  const store = storage?.() ?? null
  if (!store) return { stop: noStorage }
  return db => (args.apply ? applyDestroy(db, store, args, now) : previewDestroy(db, args, now))
}
