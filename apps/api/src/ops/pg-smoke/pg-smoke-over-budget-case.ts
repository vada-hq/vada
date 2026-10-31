import { randomUUID } from 'node:crypto'
import { koreanDateOf } from '@vada/contracts'
import type { Db } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import { decideLineItems } from '../../purchases/decide.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  fail,
  pass,
  SMOKE_RECEIPT_KEY,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'
import {
  moneyScene,
  outcomeProblem,
  purchaseOf,
  raceHolding,
  warmed,
  type MoneyScene,
} from './pg-smoke-money-kit.js'

// 예산 초과 기록(규칙 12)의 동시 처리. 판정은 쓰기 전에 읽은 사용 가능이라, 학생회 행 잠금이 없으면 겹친 거래가 앞의 커밋 전 값을 읽어 초과를 빠뜨린다.
// 먼저 잠근 쪽이 쓰고 잠금을 쥔 동안 뒤 결재가 들어온다. 뒤 결재의 사유에 앞의 금액이 들어 있어야 한다.

// 예산 항목 10만에 각 7만은 혼자서는 넘지 않고 둘이면 넘는다.
const AMOUNT = 70000
const OVER_REASON = '예산 초과 (사용 가능 -40,000원)'
const PAIR = 2

type Hold = () => Promise<void>
type Race = { context: SmokeContext; scene: MoneyScene }
type Target = { requestId: string; itemId: string }

const approveAs = (db: Db, { context, scene }: Race, target: Target, hold?: Hold) =>
  changer(
    db,
    context,
    scene.finance[0],
  )('council.view', async (tx, actor) => {
    const done = await decideLineItems(tx, actor, target.requestId, {
      now: context.now,
      input: {
        decisions: [
          {
            lineItemId: target.itemId,
            outcome: 'approved',
            amount: AMOUNT,
            budgetItemId: scene.budgetItemId,
          },
        ],
      },
    })
    await hold?.()
    return done
  })

const spendAs = (db: Db, { context, scene }: Race, hold: Hold) =>
  changer(
    db,
    context,
    scene.finance[0],
  )('council.view', async (tx, actor) => {
    const done = await createExpense(
      tx,
      actor,
      {
        commandId: randomUUID(),
        vendor: '문구점',
        eventId: null,
        sourceMessageId: null,
        description: '예산 초과 점검',
        amount: AMOUNT,
        paidOn: koreanDateOf(context.now),
        method: 'card',
        paidBy: null,
        reason: null,
        budgetItemId: scene.budgetItemId,
        requestedBy: null,
        accountId: null,
        lines: [],
      },
      { now: context.now, receiptKey: SMOKE_RECEIPT_KEY },
    )
    await hold()
    return done
  })

async function reasonOf(main: SmokeConnection, itemId: string) {
  const [row] = await main.sql.unsafe(
    `SELECT reason FROM approval WHERE target_kind = 'line_item' AND target_id = $1`,
    [itemId],
  )
  return row?.reason
}

async function approvalsRound(main: SmokeConnection, open: () => SmokeConnection, run: Race) {
  const first = await purchaseOf(main.db, run.context, run.scene, '먼저 승인')
  const second = await purchaseOf(main.db, run.context, run.scene, '뒤에 승인')
  const [holder, follower] = (await warmed(open, PAIR)) as [Db, Db]
  const results = await raceHolding(
    hold => approveAs(holder, run, first, hold),
    [() => approveAs(follower, run, second)],
  )
  const problem = outcomeProblem(results, ['ok', 'ok'])
  if (problem) return `승인 둘: ${problem}`
  const [before, after] = [await reasonOf(main, first.itemId), await reasonOf(main, second.itemId)]
  return before === null && after === OVER_REASON
    ? undefined
    : `승인 둘: 앞 ${JSON.stringify(before)}, 뒤 ${JSON.stringify(after)}`
}

async function expenseRound(main: SmokeConnection, open: () => SmokeConnection, run: Race) {
  const target = await purchaseOf(main.db, run.context, run.scene, '지출 뒤에 승인')
  const [holder, follower] = (await warmed(open, PAIR)) as [Db, Db]
  const results = await raceHolding(
    hold => spendAs(holder, run, hold),
    [() => approveAs(follower, run, target)],
  )
  const problem = outcomeProblem(results, ['ok', 'ok'])
  if (problem) return `지출과 승인: ${problem}`
  const reason = await reasonOf(main, target.itemId)
  return reason === OVER_REASON ? undefined : `지출과 승인: 뒤 ${JSON.stringify(reason)}`
}

export const overBudgetTogetherCase: SmokeCase = {
  name: '겹친 승인과 지출 뒤의 승인이 앞의 금액을 세어 예산 초과를 남긴다',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const approvals = await moneyScene(main, context, 'over-approve')
      const problem = await approvalsRound(main, open, { context, scene: approvals })
      if (problem) return fail(problem)
      const spending = await moneyScene(main, context, 'over-spend')
      const spent = await expenseRound(main, open, { context, scene: spending })
      if (spent) return fail(spent)
      return pass('겹친 거래의 뒤 승인에만 초과가 남았다')
    }),
}
