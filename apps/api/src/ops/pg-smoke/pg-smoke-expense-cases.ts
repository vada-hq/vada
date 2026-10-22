import { koreanDateOf } from '@vada/contracts'
import { cancelExpense, createExpense, reimburseExpense } from '../../expenses/service.js'
import type { Db } from '../../db/types.js'
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
} from './pg-smoke-kit.js'
import {
  moneyScene,
  outcomeProblem,
  raceHolding,
  warmed,
  type MoneyScene,
} from './pg-smoke-money-kit.js'

// 지출(기능 005)의 동시 처리 사례 m. 서비스 함수를 라우트와 같은 잠금(inCouncilChange)으로 불러 운영과 같은 길을 탄다.
// 모든 쓰기가 학생회 행 잠금을 먼저 거치므로, 이 사례가 증명하는 것은 학생회 행 잠금과 READ COMMITTED 다시 읽기다(지출 행 잠금만의 효과가 아니다).
// 그 둘이 없으면 두 번 환급 표시되거나, 취소와 환급이 서로를 못 보고 판이 겹쳐 남는다.

const EXPECTED = new Set(['NOT_REIMBURSABLE', 'EXPENSE_CANCELLED'])
const EXPENSE_AMOUNT = 12000

type Op = 'cancel' | 'reimburse'
// 먼저 잠그는 쪽(first)이 잠근 동안 others가 같은 지출에 들어온다. outcomes는 [first, ...others]의 기대 결과다.
type Scenario = {
  label: string
  first: Op
  others: readonly Op[]
  outcomes: readonly string[]
  // 만든 판 하나에 바꾼 횟수를 더한 판 수와 끝 상태
  versions: number
  cancelled: boolean
  reimbursed: boolean
}

// 취소는 환급 뒤에도 되지만 환급은 취소 뒤에 안 된다(status.ts). 그래서 순서에 따라 끝 상태가 다르다.
const SCENARIOS: readonly Scenario[] = [
  {
    label: '취소가 먼저, 환급이 뒤',
    first: 'cancel',
    others: ['reimburse'],
    outcomes: ['ok', 'NOT_REIMBURSABLE'],
    versions: 2,
    cancelled: true,
    reimbursed: false,
  },
  {
    label: '환급이 먼저, 취소가 뒤',
    first: 'reimburse',
    others: ['cancel'],
    outcomes: ['ok', 'ok'],
    versions: 3,
    cancelled: true,
    reimbursed: true,
  },
  {
    label: '환급이 먼저, 환급 둘이 뒤',
    first: 'reimburse',
    others: ['reimburse', 'reimburse'],
    outcomes: ['ok', 'NOT_REIMBURSABLE', 'NOT_REIMBURSABLE'],
    versions: 2,
    cancelled: false,
    reimbursed: true,
  },
  {
    label: '취소가 먼저, 취소 둘이 뒤',
    first: 'cancel',
    others: ['cancel', 'cancel'],
    outcomes: ['ok', 'EXPENSE_CANCELLED', 'EXPENSE_CANCELLED'],
    versions: 2,
    cancelled: true,
    reimbursed: false,
  },
]

type Run = { main: SmokeConnection; context: SmokeContext; scene: MoneyScene }

// 먼저 낸 사람이 있는 지출(환급할 수 있다)을 첫 재정부원이 적는다.
async function expenseIn(db: Db, run: Run, label: string) {
  const { context, scene } = run
  const detail = await changer(
    db,
    context,
    scene.finance[0],
  )('council.view', (tx, actor) =>
    createExpense(
      tx,
      actor,
      {
        vendor: '문구점',
        description: label,
        amount: EXPENSE_AMOUNT,
        paidOn: koreanDateOf(context.now),
        method: 'card',
        paidBy: scene.financeIds[1],
        reason: null,
        budgetItemId: null,
        requestedBy: null,
        accountId: null,
        lines: [],
      },
      context.now,
    ),
  )
  return detail.id
}

function operate(
  db: Db,
  run: Run,
  step: { expenseId: string; op: Op },
  hold?: () => Promise<void>,
) {
  const { expenseId, op } = step
  return changer(
    db,
    run.context,
    run.scene.finance[op === 'cancel' ? 0 : 1],
  )('council.view', async (tx, actor) => {
    if (op === 'cancel') await cancelExpense(tx, actor, expenseId, '점검')
    else await reimburseExpense(tx, actor, expenseId)
    await hold?.()
  })
}

async function stateOf(sql: SmokeSql, expenseId: string) {
  const [row] = await sql.unsafe(
    `SELECT cancelled_at IS NOT NULL AS cancelled, reimbursed_at IS NOT NULL AS reimbursed
       FROM expense WHERE id = $1`,
    [expenseId],
  )
  return { cancelled: row?.cancelled === true, reimbursed: row?.reimbursed === true }
}

async function scenarioRound(open: Parameters<typeof warmed>[0], run: Run, scenario: Scenario) {
  const expenseId = await expenseIn(run.main.db, run, scenario.label)
  const [holder, ...rest] = await warmed(open, 1 + scenario.others.length)
  const results = await raceHolding(
    hold => operate(holder!, run, { expenseId, op: scenario.first }, hold),
    rest.map((db, index) => () => operate(db, run, { expenseId, op: scenario.others[index]! })),
  )
  const bad = unexpectedFailures(results, EXPECTED)
  if (bad.length > 0) return fail('지출 처리가 예상하지 못한 오류로 끝났다', bad[0])
  const problem = outcomeProblem(results, scenario.outcomes)
  if (problem) return fail(`${scenario.label}: ${problem}`)
  const versions = await versionsOf(run.main.sql, expenseId)
  if (versions.count !== scenario.versions || versions.open !== 1 || !versions.lastOpen)
    return fail(
      `${scenario.label}: 판 ${versions.count}개, 열린 판 ${versions.open}개(기대 ${scenario.versions}개, 1개)`,
    )
  const state = await stateOf(run.main.sql, expenseId)
  return state.cancelled === scenario.cancelled && state.reimbursed === scenario.reimbursed
    ? undefined
    : fail(
        `${scenario.label}: 끝 상태가 기대와 다르다(취소 ${state.cancelled}, 환급 ${state.reimbursed})`,
      )
}

export const expenseTogetherCase: SmokeCase = {
  name: '같은 지출을 동시에 취소하고 환급',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'm')
      for (const scenario of SCENARIOS) {
        const problem = await scenarioRound(open, { main, context, scene }, scenario)
        if (problem) return problem
      }
      return pass(
        `${SCENARIOS.length}가지 순서 모두 하나씩만 처리되고 판 수와 끝 상태가 기대와 같다`,
      )
    }),
}
