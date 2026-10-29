import { randomUUID } from 'node:crypto'
import { koreanDateOf } from '@vada/contracts'
import type { Db } from '../../db/types.js'
import { confirmDeposit } from '../../deposits/service.js'
import { createExpense } from '../../expenses/service.js'
import { clockNow } from '../../records/records.js'
import { applyToForm } from '../../registrations/apply.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  fail,
  pass,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
  SMOKE_RECEIPT_KEY,
} from './pg-smoke-kit.js'
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'
import {
  completeAs,
  completeFirst,
  count,
  make,
  newEvent,
  PAIR,
  worldOf,
  type World,
} from './pg-smoke-complete-kit.js'

// 행사 완료(기능 008 조각 4)와 그 행사에 닿는 쓰기가 겹치는 사례 x, y, z. 서비스 함수를 라우트와 같은 거래로 부르되 학생회 행 잠금(inCouncilChange)은 걸지 않는다.
// 공개 신청은 학생회 행을 잠그지 않아 완료와는 행사 행에서만 만난다(DEC-68). 나머지도 그 잠금 하나로 하나로 정해지는지 본다.
// PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.
// 사용자 이름 글자(x, y, z)는 다른 사례(a~e, g~q, s, t, u, w)와 겹치지 않아야 한다. 공개 코드도 사례마다 다르다.
const ROUNDS = 4
const HOUR_MS = 3_600_000
const DEPOSIT_WON = 5000
const LINE_WON = 1000

// 그 행사의 요청 품목 하나가 이미 증빙과 사유가 있는 지출로 결제된 상태(완료할 수 있다)
async function settledLine(world: World, eventId: string) {
  const requestId = await make(world, 'request', {
    type: 'purchase',
    title: '마커',
    requestedBy: world.leader.memberId,
    eventId,
  })
  const lineId = await make(world, 'line_item', { requestId, name: '마커', quantity: 1 })
  await make(world, 'approval', {
    targetId: lineId,
    targetKind: 'line_item',
    outcome: 'approved',
    actorId: world.leader.memberId,
    actorKind: 'member',
    actedAt: clockNow,
  })
  const paid = await make(world, 'expense', {
    amount: String(LINE_WON),
    paidAt: world.context.now,
    description: '마커',
    vendor: '문구점',
    method: 'card',
    reason: '준비',
    eventId,
  })
  await make(world, 'payment_line', {
    expenseId: paid,
    lineItemId: lineId,
    amount: String(LINE_WON),
  })
  await make(world, 'evidence', { expenseId: paid, type: 'receipt' })
  return lineId
}

// 사례 x: 완료와 그 행사 품목을 결제하는 지출 적기. 결제한 품목 요청의 행사가 완료하면 지출은 409다.
async function expenseRound(world: World, open: () => SmokeConnection) {
  const eventId = await newEvent(world)
  const lineId = await settledLine(world, eventId)
  const input = {
    commandId: randomUUID(),
    vendor: '문구점',
    eventId: null,
    sourceMessageId: null,
    description: '마커 더',
    amount: LINE_WON,
    paidOn: koreanDateOf(world.context.now),
    method: 'card' as const,
    paidBy: null,
    reason: null,
    budgetItemId: null,
    requestedBy: null,
    accountId: null,
    lines: [{ lineItemId: lineId, amount: LINE_WON }],
  }
  const spend = (db: Db) =>
    db.transaction(tx =>
      createExpense(tx, world.finance, input, {
        now: world.context.now,
        receiptKey: SMOKE_RECEIPT_KEY,
      }),
    )
  const problem = await completeFirst(open, world, { eventId, other: spend })
  if (problem) return problem
  const lines = await count(
    world.main,
    'SELECT count(*)::text AS n FROM payment_line WHERE line_item_id = $1',
    [lineId],
  )
  return lines === 1 ? undefined : `완료한 행사의 품목에 결제 내역이 ${lines}개(1개여야 한다)`
}

export const completeAndSpendCase: SmokeCase = {
  name: '행사 완료와 그 행사 지출 적기가 겹침',
  run: context =>
    withConnections(context, async open => {
      const world = await worldOf(open(), context, 'smoke-x-host')
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await expenseRound(world, open)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 완료가 되고 지출 적기는 EVENT_COMPLETED였다`)
    }),
}

async function depositScene(world: World) {
  const eventId = await newEvent(world)
  const formId = await make(world, 'registration_form', {
    eventId,
    name: '점검 양식',
    closesAt: new Date(world.context.now.getTime() + HOUR_MS),
    publicCode: `MAKEYA${nextDigit()}2`,
  })
  const registrationId = await make(world, 'registration', {
    formId,
    name: '점검 신청자',
    appliedFee: String(DEPOSIT_WON),
  })
  return { eventId, registrationId }
}

let digit = 0
const DIGITS = '23456789'
const nextDigit = () => DIGITS[digit++ % DIGITS.length]

// 사례 y: 완료와 입금 확인. 완료가 먼저면 입금 확인은 409, 입금 확인이 먼저면 둘 다 되고 그 입금이 완료 때 만든 수입에 이어진다.
async function depositRound(world: World, open: () => SmokeConnection, round: number) {
  const { eventId, registrationId } = await depositScene(world)
  const confirm = (db: Db, hold?: () => Promise<void>) =>
    db.transaction(async tx => {
      const done = await confirmDeposit(tx, world.leader, registrationId, { amount: DEPOSIT_WON })
      await hold?.()
      return done
    })
  if (round % PAIR === 0) {
    const problem = await completeFirst(open, world, { eventId, other: db => confirm(db) })
    if (problem) return problem
    const live = await count(
      world.main,
      'SELECT count(*)::text AS n FROM deposit WHERE registration_id = $1',
      [registrationId],
    )
    return live === 0 ? undefined : `완료한 행사에 입금 기록이 ${live}개`
  }
  const [first, second] = (await warmed(open, PAIR)) as [Db, Db]
  const results = await raceHolding(
    hold => confirm(first, hold),
    [() => completeAs(second, world, eventId)],
  )
  const bad = unexpectedFailures(results, new Set())
  if (bad.length > 0) return fail('예상하지 못한 오류로 끝났다', bad[0])
  const problem = outcomeProblem(results, ['ok', 'ok'])
  if (problem) return problem
  const unlinked = await count(
    world.main,
    'SELECT count(*)::text AS n FROM deposit WHERE registration_id = $1 AND income_id IS NULL',
    [registrationId],
  )
  return unlinked === 0 ? undefined : '완료 전에 확인한 입금이 참가비 수입에 이어지지 않았다'
}

export const completeAndConfirmCase: SmokeCase = {
  name: '행사 완료와 입금 확인이 겹침',
  run: context =>
    withConnections(context, async open => {
      const world = await worldOf(open(), context, 'smoke-y-host')
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await depositRound(world, open, round)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 완료와 입금 확인이 하나로 정해졌고 완료 뒤 입금 기록이 없다`)
    }),
}

// 사례 z: 완료와 공개 신청. 공개 신청은 학생회 행을 잠그지 않으므로 행사 행 잠금이 둘을 가른다.
async function applyRound(world: World, open: () => SmokeConnection) {
  const { eventId, formId } = await (async () => {
    const id = await newEvent(world)
    const form = await make(world, 'registration_form', {
      eventId: id,
      name: '점검 양식',
      closesAt: new Date(world.context.now.getTime() + HOUR_MS),
      publicCode: `MAKEZA${nextDigit()}2`,
      // 이름만으로 신청하므로 학번 받기를 끈다(DEC-75).
      collectsStudentId: false,
    })
    return { eventId: id, formId: form }
  })()
  const [row] = await world.main.sql.unsafe(
    'SELECT public_code FROM registration_form WHERE id = $1',
    [formId],
  )
  const apply = (db: Db) =>
    db.transaction(tx =>
      applyToForm(
        tx,
        { code: String(row?.public_code), now: world.context.now, receiptKey: 'smoke-receipt-key' },
        { commandId: randomUUID(), name: '점검 신청자', studentId: null, phone: null, answers: [] },
      ),
    )
  const problem = await completeFirst(open, world, {
    eventId,
    other: apply,
    blocked: 'REGISTRATION_NOT_OPEN',
  })
  if (problem) return problem
  const made = await count(
    world.main,
    'SELECT count(*)::text AS n FROM registration WHERE form_id = $1',
    [formId],
  )
  return made === 0 ? undefined : `완료한 행사의 양식에 신청이 ${made}개`
}

export const completeAndApplyCase: SmokeCase = {
  name: '행사 완료와 공개 신청이 겹침',
  run: context =>
    withConnections(context, async open => {
      const world = await worldOf(open(), context, 'smoke-z-host')
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await applyRound(world, open)
        if (problem) return typeof problem === 'string' ? fail(`${round}번째: ${problem}`) : problem
      }
      return pass(`${ROUNDS}번 모두 완료가 되고 공개 신청은 REGISTRATION_NOT_OPEN이었다`)
    }),
}
