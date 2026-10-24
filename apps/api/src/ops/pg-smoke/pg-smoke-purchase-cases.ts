import { koreanDateOf } from '@vada/contracts'
import type { Db } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import { cancelLineItem } from '../../purchases/cancel-item.js'
import { decideLineItems } from '../../purchases/decide.js'
import { cancelPurchaseRequest } from '../../purchases/service.js'
import type { SmokeConnection, SmokeSql } from './pg-smoke-connection.js'
import {
  changer,
  fail,
  pass,
  unexpectedFailures,
  versionsOf,
  withConnections,
  type SmokeCase,
  type SmokeContext,
  type Who,
} from './pg-smoke-kit.js'
import {
  moneyScene,
  outcomeProblem,
  purchaseOf,
  raceHolding,
  warmed,
  type MoneyScene,
} from './pg-smoke-money-kit.js'

// 구매 요청(기능 005)의 동시 처리 사례 k, l. 서비스 함수를 라우트와 같은 잠금(inCouncilChange)으로 불러 운영과 같은 길을 탄다.
// 모든 쓰기가 학생회 행 잠금을 먼저 거치므로, 이 사례가 증명하는 것은 학생회 행 잠금과 READ COMMITTED 다시 읽기다(요청·품목 행 잠금만의 효과가 아니다).
// 그 둘이 없으면 같은 품목에 결재 기록이 둘 남거나, 취소된 요청에 결재가 남거나 결재된 요청이 취소된다.

const EXPECTED = new Set(['LINE_ITEM_DECIDED', 'REQUEST_CLOSED'])
const APPROVED_AMOUNT = 5000
const FINANCE_COUNT = 2
const PAIR = 2
// 품목의 판: 요청을 낼 때 하나, 승인할 때 하나
const VERSIONS_AFTER_APPROVAL = 2

type Target = { requestId: string; itemId: string }
type Race = {
  main: SmokeConnection
  open: () => SmokeConnection
  context: SmokeContext
  scene: MoneyScene
}
// 쓰고 난 뒤 잠금을 쥔 채 기다리는 함수. 먼저 잠그는 쪽에만 준다.
type Hold = () => Promise<void>

const decideAs = (run: Race, as: { db: Db; who: Who }, target: Target, hold?: Hold) =>
  changer(
    as.db,
    run.context,
    as.who,
  )('council.view', async (tx, actor) => {
    const done = await decideLineItems(tx, actor, target.requestId, {
      now: run.context.now,
      input: {
        decisions: [
          {
            lineItemId: target.itemId,
            outcome: 'approved',
            amount: APPROVED_AMOUNT,
            budgetItemId: run.scene.budgetItemId,
          },
        ],
      },
    })
    await hold?.()
    return done
  })

const cancelAs = (run: Race, db: Db, target: Target, hold?: Hold) =>
  changer(
    db,
    run.context,
    run.scene.requester,
  )('council.view', async (tx, actor) => {
    await cancelPurchaseRequest(tx, actor, target.requestId)
    await hold?.()
  })

// 이 품목의 결재 기록 수
async function approvalsOf(sql: SmokeSql, itemId: string) {
  const [row] = await sql.unsafe(
    `SELECT count(*)::text AS n FROM approval WHERE target_kind = 'line_item' AND target_id = $1`,
    [itemId],
  )
  return Number(row?.n)
}

async function cancelledOf(sql: SmokeSql, requestId: string) {
  const [row] = await sql.unsafe(
    'SELECT cancelled_at IS NOT NULL AS c FROM request WHERE id = $1',
    [requestId],
  )
  return row?.c === true
}

// 사례 k: 재정부원들이 같은 품목을 동시에 결재 -------------------------------------------

const K_LOSERS = 3
const K_ROUNDS = 3

// 먼저 결재해 요청 행과 품목 행을 쥔 쪽이 있는 동안 다른 결재 셋이 같은 품목을 결재한다. 하나만 되고 나머지는 LINE_ITEM_DECIDED다.
async function decideRound(run: Race, round: number) {
  const { main, open, context, scene } = run
  const target = await purchaseOf(main.db, context, scene, `결재 ${round}`)
  const [holder, ...rest] = await warmed(open, 1 + K_LOSERS)
  const results = await raceHolding(
    hold => decideAs(run, { db: holder!, who: scene.finance[0] }, target, hold),
    rest.map(
      (db, index) => () =>
        decideAs(run, { db, who: scene.finance[(index + 1) % FINANCE_COUNT]! }, target),
    ),
  )
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail('결재가 예상하지 못한 오류로 끝났다', bad[0])
  const losers = Array<string>(K_LOSERS).fill('LINE_ITEM_DECIDED')
  const problem = outcomeProblem(results, ['ok', ...losers])
  if (problem) return fail(`${round}번째: ${problem}`)
  const approvals = await approvalsOf(main.sql, target.itemId)
  if (approvals !== 1) return fail(`${round}번째: 결재 기록이 ${approvals}개다(1개여야 한다)`)
  const versions = await versionsOf(main.sql, target.itemId)
  return versions.count === VERSIONS_AFTER_APPROVAL && versions.open === 1
    ? undefined
    : fail(
        `${round}번째: 품목의 판 ${versions.count}개, 열린 판 ${versions.open}개(2개, 1개여야 한다)`,
      )
}

export const decideTogetherCase: SmokeCase = {
  name: '같은 품목을 재정부원들이 동시에 결재',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'k')
      for (let round = 0; round < K_ROUNDS; round++) {
        const problem = await decideRound({ main, open, context, scene }, round)
        if (problem) return problem
      }
      return pass(
        `${K_ROUNDS}번 모두 결재 하나만 되고 나머지 ${K_LOSERS}명은 이미 결재됨으로 막혔다`,
      )
    }),
}

// 사례 l: 요청 취소와 결재를 동시에 ---------------------------------------------------

const L_ROUNDS = 4

// 먼저 잠근 쪽이 취소인 판과 결재인 판을 번갈아 돌린다. 어느 쪽이든 하나만 되고 다른 쪽은 REQUEST_CLOSED다.
// 취소가 되면 결재 기록은 0이고, 결재가 되면 요청은 취소되지 않은 채다.
async function cancelRound(run: Race, round: number) {
  const { main, open, context, scene } = run
  const cancelFirst = round % PAIR === 0
  const target = await purchaseOf(main.db, context, scene, `취소 ${round}`)
  const [first, second] = (await warmed(open, PAIR)) as [Db, Db]
  const results = cancelFirst
    ? await raceHolding(
        hold => cancelAs(run, first, target, hold),
        [() => decideAs(run, { db: second, who: scene.finance[0] }, target)],
      )
    : await raceHolding(
        hold => decideAs(run, { db: first, who: scene.finance[0] }, target, hold),
        [() => cancelAs(run, second, target)],
      )
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail('취소나 결재가 예상하지 못한 오류로 끝났다', bad[0])
  const label = `${round}번째(${cancelFirst ? '취소' : '결재'}가 먼저)`
  const problem = outcomeProblem(results, ['ok', 'REQUEST_CLOSED'])
  if (problem) return fail(`${label}: ${problem}`)
  const approvals = await approvalsOf(main.sql, target.itemId)
  const cancelled = await cancelledOf(main.sql, target.requestId)
  const wanted = cancelFirst ? 0 : 1
  return approvals === wanted && cancelled === cancelFirst
    ? undefined
    : fail(
        `${label}: 결재 기록 ${approvals}개, 취소 ${cancelled}(기대 ${wanted}개, ${cancelFirst})`,
      )
}

export const cancelAndDecideCase: SmokeCase = {
  name: '구매 요청 취소와 결재를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'l')
      for (let round = 0; round < L_ROUNDS; round++) {
        const problem = await cancelRound({ main, open, context, scene }, round)
        if (problem) return problem
      }
      return pass(
        '취소가 먼저면 결재 기록 0개, 결재가 먼저면 취소되지 않고, 어느 쪽이든 하나만 됐다',
      )
    }),
}

// 사례 n: 승인한 품목 취소와 그 품목을 결제하는 지출 적기를 동시에 -------------------------------

const N_ROUNDS = 4
const N_EXPECTED = new Set(['LINE_ITEM_NOT_CANCELLABLE', 'LINE_ITEM_NOT_PAYABLE'])

const cancelItemAs = (run: Race, db: Db, target: Target, hold?: Hold) =>
  changer(
    db,
    run.context,
    run.scene.finance[0],
  )('council.view', async (tx, actor) => {
    await cancelLineItem(
      tx,
      actor,
      { requestId: target.requestId, lineItemId: target.itemId },
      { input: { reason: '점검' }, now: run.context.now },
    )
    await hold?.()
  })

const payItemAs = (run: Race, db: Db, target: Target, hold?: Hold) =>
  changer(
    db,
    run.context,
    run.scene.finance[1],
  )('council.view', async (tx, actor) => {
    await createExpense(
      tx,
      actor,
      {
        vendor: '문구점',
        eventId: null,
        sourceMessageId: null,
        description: '점검',
        amount: APPROVED_AMOUNT,
        paidOn: koreanDateOf(run.context.now),
        method: 'card',
        paidBy: null,
        reason: null,
        budgetItemId: null,
        requestedBy: null,
        accountId: null,
        lines: [{ lineItemId: target.itemId, amount: APPROVED_AMOUNT }],
      },
      run.context.now,
    )
    await hold?.()
  })

async function paymentsOf(sql: SmokeSql, itemId: string) {
  const [row] = await sql.unsafe(
    'SELECT count(*)::text AS n FROM payment_line WHERE line_item_id = $1',
    [itemId],
  )
  return Number(row?.n)
}

async function cancelsOf(sql: SmokeSql, itemId: string) {
  const [row] = await sql.unsafe(
    `SELECT count(*)::text AS n FROM approval WHERE target_kind = 'line_item' AND target_id = $1 AND outcome = 'cancelled'`,
    [itemId],
  )
  return Number(row?.n)
}

// 승인한 품목을 두고, 먼저 잠그는 쪽이 취소인 판과 결제인 판을 번갈아 돌린다. 하나만 되고 다른 쪽은 막힌다:
// 취소가 되면 결제 내역 0개, 결제가 되면 취소 기록 0개다. 둘 다 학생회 행 잠금 뒤에 결제 가능·취소 가능을 읽는다.
async function cancelPayRound(run: Race, round: number) {
  const { main, open, context, scene } = run
  const cancelFirst = round % PAIR === 0
  const target = await purchaseOf(main.db, context, scene, `취소·결제 ${round}`)
  await changer(
    main.db,
    context,
    scene.finance[0],
  )('council.view', (tx, actor) =>
    decideLineItems(tx, actor, target.requestId, {
      now: context.now,
      input: {
        decisions: [
          {
            lineItemId: target.itemId,
            outcome: 'approved',
            amount: APPROVED_AMOUNT,
            budgetItemId: scene.budgetItemId,
          },
        ],
      },
    }),
  )
  const [first, second] = (await warmed(open, PAIR)) as [Db, Db]
  const results = cancelFirst
    ? await raceHolding(
        hold => cancelItemAs(run, first, target, hold),
        [() => payItemAs(run, second, target)],
      )
    : await raceHolding(
        hold => payItemAs(run, first, target, hold),
        [() => cancelItemAs(run, second, target)],
      )
  const bad = unexpectedFailures(results, N_EXPECTED)
  if (bad.length > 0) return fail('품목 취소나 결제가 예상하지 못한 오류로 끝났다', bad[0])
  const label = `${round}번째(${cancelFirst ? '취소' : '결제'}가 먼저)`
  const problem = outcomeProblem(results, [
    'ok',
    cancelFirst ? 'LINE_ITEM_NOT_PAYABLE' : 'LINE_ITEM_NOT_CANCELLABLE',
  ])
  if (problem) return fail(`${label}: ${problem}`)
  const payments = await paymentsOf(main.sql, target.itemId)
  const cancels = await cancelsOf(main.sql, target.itemId)
  return payments === (cancelFirst ? 0 : 1) && cancels === (cancelFirst ? 1 : 0)
    ? undefined
    : fail(`${label}: 결제 내역 ${payments}개, 취소 기록 ${cancels}개`)
}

export const cancelItemAndPayCase: SmokeCase = {
  name: '승인한 품목 취소와 그 품목의 결제를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'n')
      for (let round = 0; round < N_ROUNDS; round++) {
        const problem = await cancelPayRound({ main, open, context, scene }, round)
        if (problem) return problem
      }
      return pass(
        '취소가 먼저면 결제 내역 0개, 결제가 먼저면 취소 기록 0개이고, 어느 쪽이든 하나만 됐다',
      )
    }),
}
