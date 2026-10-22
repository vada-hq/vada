import { lockCouncil } from '../../access/authorize.js'
import { publishClosing } from '../../closing/publish.js'
import type { Db, Tx } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import { completeEvent } from '../../settlement/complete.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  fail,
  pass,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'
import { count, make, PAIR, worldOf, type World } from './pg-smoke-complete-kit.js'

// 결산 공개(기능 009 조각 4)와 겹치는 쓰기 사례 cl1, cl2, cl3. 서비스 함수를 라우트와 같은 거래로 부르되, 라우트가 거는 학생회 행 잠금
// (inCouncilChange)은 lockCouncil로 직접 건다. 공개와 지출·수입·행사 완료가 같은 학생회 안에서 그 잠금 하나로 한 줄이 되는지 본다.
// PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.
// 사용자 이름 글자(cl1, cl2, cl3)는 다른 사례(a~e, g~q, s~z)와 겹치지 않아야 한다. 공개 코드도 사례마다 다르다.
// 기간은 둘이다: 끝난 앞 기간(공개할 기간)과 지금 기간(이월금이 생길 곳).
const PERIODS = [
  { name: '점검 1기', startsOn: '2000-01-01', endsOn: '2025-12-31' },
  { name: '점검 2기', startsOn: '2026-01-01', endsOn: '2099-12-31' },
] as const
const INCOME_WON = 100_000
const EXPENSE_WON = 30_000
const FEE_WON = 5000
const HOUR_MS = 3_600_000
const ROUNDS = 2
const PAID_ON = '2025-06-02'
const CODE_DIGITS = '23456789'
let digit = 0
const nextDigit = () => CODE_DIGITS[digit++ % CODE_DIGITS.length]

const incomeOf = (world: World) =>
  make(world, 'income', {
    fiscalPeriodId: world.periodIds[0],
    source: 'fee',
    amount: String(INCOME_WON),
    receivedOn: '2025-06-01',
  })

// 학생회 행 잠금을 건 거래. 먼저 쓰는 쪽은 hold()로 잠금을 쥔 채 잠시 기다린다.
const asCouncil = (
  db: Db,
  world: World,
  run: (tx: Tx) => Promise<unknown>,
  hold?: () => Promise<void>,
) =>
  db.transaction(async tx => {
    await lockCouncil(tx, world.leader.councilId)
    const done = await run(tx)
    await hold?.()
    return done
  })

const publishAs = (world: World) => (tx: Tx) =>
  publishClosing(tx, world.finance, world.periodIds[0]!, world.context.now)

const carryoverOf = async (world: World) => {
  const rows = await world.main.sql.unsafe(
    `SELECT count(*)::text AS n, coalesce(sum(amount), 0)::text AS total FROM income
     WHERE source = 'carryover' AND cancelled_at IS NULL AND fiscal_period_id = $1`,
    [world.periodIds[1]!],
  )
  return { n: Number(rows[0]?.n), total: Number(rows[0]?.total) }
}

// 첫 쓰기가 잠금을 쥔 채 기다리고 둘째가 들어온다. 기대한 결과로 끝나지 않으면 어긋난 모양을 돌려준다.
async function race(
  open: () => SmokeConnection,
  first: (db: Db, hold: () => Promise<void>) => Promise<unknown>,
  second: (db: Db) => Promise<unknown>,
  want: { expected: readonly string[]; blocked: ReadonlySet<string> },
) {
  const [a, b] = (await warmed(open, PAIR)) as [Db, Db]
  const results = await raceHolding(hold => first(a, hold), [() => second(b)])
  const bad = unexpectedFailures(results, want.blocked)
  if (bad.length > 0) return fail('예상하지 못한 오류로 끝났다', bad[0])
  return outcomeProblem(results, want.expected)
}

// 사례 cl1: 두 재정부원이 같은 기간을 동시에 공개. 하나는 공개되고 하나는 CLOSING_PUBLISHED이며 결산 기록과 이월금은 하나다.
export const publishTogetherCase: SmokeCase = {
  name: '두 재정부원이 같은 결산을 동시에 공개',
  run: context =>
    withConnections(context, async open => {
      const world = await worldOf(open(), context, 'smoke-cl1-host', PERIODS)
      await incomeOf(world)
      const problem = await race(
        open,
        (db, hold) => asCouncil(db, world, publishAs(world), hold),
        db => asCouncil(db, world, publishAs(world)),
        { expected: ['ok', 'CLOSING_PUBLISHED'], blocked: new Set(['CLOSING_PUBLISHED']) },
      )
      if (problem) return typeof problem === 'string' ? fail(problem) : problem
      const closings = await count(
        world.main,
        'SELECT count(*)::text AS n FROM account_closing WHERE fiscal_period_id = ANY($1::uuid[])',
        [world.periodIds],
      )
      const carry = await carryoverOf(world)
      return closings === 1 && carry.n === 1 && carry.total === INCOME_WON
        ? pass('공개는 한 번이고 결산 기록 1개, 이월금 1개(남은 돈과 같다)')
        : fail(`결산 기록 ${closings}개, 이월금 ${carry.n}개 ${carry.total}원`)
    }),
}

const expenseInput = (world: World) => ({
  vendor: '문구점',
  eventId: null,
  description: '마커',
  amount: EXPENSE_WON,
  paidOn: PAID_ON,
  method: 'card' as const,
  paidBy: null,
  reason: null,
  budgetItemId: null,
  requestedBy: null,
  accountId: null,
  lines: [],
  now: world.context.now,
})

// 사례 cl2: 공개와 같은 기간 지출 적기. 공개가 먼저면 지출은 PERIOD_CLOSED이고 이월금은 지출을 뺀 값이 아니다.
// 지출이 먼저면 둘 다 되고 이월금은 지출을 뺀 남은 돈이다.
async function expenseRound(open: () => SmokeConnection, context: SmokeContext, round: number) {
  const world = await worldOf(open(), context, `smoke-cl2-r${round}`, PERIODS)
  await incomeOf(world)
  const { now, ...input } = expenseInput(world)
  const spend = (tx: Tx) => createExpense(tx, world.finance, input, now)
  const publishFirst = round % PAIR === 0
  const problem = publishFirst
    ? await race(
        open,
        (db, hold) => asCouncil(db, world, publishAs(world), hold),
        db => asCouncil(db, world, spend),
        { expected: ['ok', 'PERIOD_CLOSED'], blocked: new Set(['PERIOD_CLOSED']) },
      )
    : await race(
        open,
        (db, hold) => asCouncil(db, world, spend, hold),
        db => asCouncil(db, world, publishAs(world)),
        { expected: ['ok', 'ok'], blocked: new Set() },
      )
  if (problem) return problem
  const spent = await count(
    world.main,
    'SELECT count(*)::text AS n FROM expense e JOIN record r ON r.id = e.id WHERE r.council_id = $1',
    [world.leader.councilId],
  )
  const carry = await carryoverOf(world)
  const wanted = publishFirst ? INCOME_WON : INCOME_WON - EXPENSE_WON
  if (spent !== (publishFirst ? 0 : 1)) return `지출이 ${spent}개`
  return carry.n === 1 && carry.total === wanted
    ? undefined
    : `이월금 ${carry.n}개 ${carry.total}원(기대 ${wanted}원)`
}

export const publishAndSpendCase: SmokeCase = {
  name: '결산 공개와 그 기간 지출 적기가 겹침',
  run: context =>
    withConnections(context, async open => {
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await expenseRound(open, context, round)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 한 줄로 정해졌고 이월금은 잠그기 전까지의 남은 돈과 같다`)
    }),
}

// 앞 기간에 입금을 확인했고 앞 기간에 끝난 행사 하나(완료하지 않았다)
async function feeEvent(world: World) {
  const eventId = await make(world, 'event', {
    name: '점검 행사',
    startsAt: new Date('2025-06-10T00:00:00Z'),
  })
  const formId = await make(world, 'registration_form', {
    eventId,
    name: '점검 양식',
    closesAt: new Date(world.context.now.getTime() + HOUR_MS),
    publicCode: `MAKECL${nextDigit()}2`,
  })
  const registrationId = await make(world, 'registration', {
    formId,
    name: '점검 신청자',
    appliedFee: String(FEE_WON),
  })
  await make(world, 'deposit', {
    registrationId,
    amount: String(FEE_WON),
    confirmedAt: new Date('2025-06-11T03:00:00Z'),
  })
  return eventId
}

// 사례 cl3: 공개와 그 기간 행사 완료. 완료가 먼저면 공개가 그 참가비 수입을 남은 돈에 넣고 되며, 공개가 먼저면 FEE_INCOME_PENDING이다.
async function completeRound(open: () => SmokeConnection, context: SmokeContext, round: number) {
  const world = await worldOf(open(), context, `smoke-cl3-r${round}`, PERIODS)
  await incomeOf(world)
  const eventId = await feeEvent(world)
  const complete = (tx: Tx) =>
    completeEvent(tx, world.leader, { eventId, now: world.context.now }, { reason: null })
  const completeFirst = round % PAIR === 0
  const problem = completeFirst
    ? await race(
        open,
        (db, hold) => asCouncil(db, world, complete, hold),
        db => asCouncil(db, world, publishAs(world)),
        { expected: ['ok', 'ok'], blocked: new Set() },
      )
    : await race(
        open,
        (db, hold) => asCouncil(db, world, publishAs(world), hold),
        db => asCouncil(db, world, complete),
        { expected: ['FEE_INCOME_PENDING', 'ok'], blocked: new Set(['FEE_INCOME_PENDING']) },
      )
  if (problem) return problem
  const closings = await count(
    world.main,
    'SELECT count(*)::text AS n FROM account_closing WHERE fiscal_period_id = ANY($1::uuid[])',
    [world.periodIds],
  )
  const carry = await carryoverOf(world)
  if (!completeFirst)
    return closings === 0 ? undefined : `막힌 공개가 결산 기록 ${closings}개를 남겼다`
  return closings === 1 && carry.total === INCOME_WON + FEE_WON
    ? undefined
    : `결산 기록 ${closings}개, 이월금 ${carry.total}원(기대 ${INCOME_WON + FEE_WON}원)`
}

export const publishAndCompleteCase: SmokeCase = {
  name: '결산 공개와 그 기간 행사 완료가 겹침',
  run: context =>
    withConnections(context, async open => {
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await completeRound(open, context, round)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 한 줄로 정해졌고 공개된 남은 돈에 참가비가 든다`)
    }),
}
