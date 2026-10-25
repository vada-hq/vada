import { randomUUID } from 'node:crypto'
import { koreanDateOf } from '@vada/contracts'
import type { Db } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import { errorCodeOf } from '../../db/error-code.js'
import {
  applyAs,
  oneSeatForm,
  raceSceneOf,
  savedProblem,
  type Race,
} from './pg-smoke-registration-cases.js'
import {
  changer,
  fail,
  pass,
  SMOKE_RECEIPT_KEY,
  unexpectedFailures,
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
import type { SmokeConnection } from './pg-smoke-connection.js'

// 같은 명령 번호의 재전송이 겹쳐도 신청과 영수증이 하나만 남는지(기능 017, DEC-84, RULE-45). 서비스 함수를 라우트와 같은 거래로 불러 운영과 같은 길을 탄다.
// 정원이 1인 양식이라 영수증을 못 보면 두 번째 신청이 REGISTRATION_FULL이 된다: 둘 다 성공(ok,ok)해야 한다.
// 양식 행 잠금이 없어도 command_receipt의 UNIQUE가 마지막으로 막으므로(23505) 둘 다 저장되는 일은 없다. PGlite는 거래를 하나씩 돌려 이것을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.

const WHO = { host: 'smoke-cmd-host', councilName: '점검 명령 학생회', codePrefix: 'CMDS222' }
const ROUNDS = 4
const PAIR = 2
const UNIQUE_VIOLATION = '23505'

// 영수증이 이 양식에 하나만 있는지
async function receiptProblem(run: Race, code: string) {
  const [saved] = await run.main.sql.unsafe(
    `SELECT count(*)::text AS n FROM command_receipt c
     JOIN registration r ON r.id = c.result_id
     JOIN registration_form f ON f.id = r.form_id WHERE f.public_code = $1`,
    [code],
  )
  return saved?.n === '1' ? undefined : `영수증 ${String(saved?.n)}개(하나여야 한다)`
}

// 먼저 보낸 쪽이 양식 행 잠금을 쥔 채 기다리는 동안 같은 명령이 들어온다: 잠금 뒤에 영수증을 읽어 새 신청 없이 ok여야 한다.
async function holdingRound(run: Race, round: number) {
  const code = await oneSeatForm(run, round)
  const commandId = randomUUID()
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  return raceHolding(
    hold => applyAs(first, run, code, { hold, commandId }),
    [() => applyAs(second, run, code, { commandId })],
  ).then(results => ({ results, code }))
}

// 기다리는 쪽 없이 둘이 동시에 시작한다.
async function plainRound(run: Race, round: number) {
  const code = await oneSeatForm(run, round)
  const commandId = randomUUID()
  const [first, second] = (await warmed(run.open, PAIR)) as [Db, Db]
  const results = await Promise.allSettled([
    applyAs(first, run, code, { commandId }),
    applyAs(second, run, code, { commandId }),
  ])
  return { results, code }
}

// UNIQUE가 막는지: 같은 (종류, 범위, 번호)의 영수증을 하나 더 넣으면 23505다. 앱의 잠금이 틀려도 둘이 남지 않게 하는 마지막 겹이다.
async function uniqueProblem(run: Race, code: string) {
  try {
    await run.main.sql.unsafe(
      `INSERT INTO command_receipt (kind, scope_key, command_id, body_hash, result_id, result_kind)
       SELECT c.kind, c.scope_key, c.command_id, c.body_hash, c.result_id, c.result_kind FROM command_receipt c
       JOIN registration r ON r.id = c.result_id
       JOIN registration_form f ON f.id = r.form_id WHERE f.public_code = $1`,
      [code],
    )
    return '같은 명령의 영수증이 하나 더 들어갔다(UNIQUE가 없다)'
  } catch (error) {
    return errorCodeOf(error) === UNIQUE_VIOLATION ? undefined : '23505가 아닌 오류로 멈췄다'
  }
}

export const sameCommandTogetherCase: SmokeCase = {
  name: '같은 명령을 동시에 두 번',
  run: context =>
    withConnections(context, async open => {
      const run = await raceSceneOf(context, open, WHO)
      for (let round = 0; round < ROUNDS; round++) {
        const { results, code } =
          round % PAIR === 0 ? await holdingRound(run, round) : await plainRound(run, round)
        const bad = unexpectedFailures(results, new Set())
        if (bad.length > 0) return fail(`${round}번째: 예상하지 못한 오류로 끝났다`, bad[0])
        const problem =
          outcomeProblem(results, ['ok', 'ok']) ??
          (await savedProblem(run, code)) ??
          (await receiptProblem(run, code)) ??
          (await uniqueProblem(run, code))
        if (problem) return fail(`${round}번째: ${problem}`)
      }
      return pass(`${ROUNDS}번 모두 둘 다 성공하고 신청·개인 링크·영수증이 하나만 남았다`)
    }),
}

// 지출 적기의 같은 명령(기능 017, DEC-84, RULE-45). 학생회 행 잠금이 같은 (학생회, 운영진, 번호) 둘을 줄 세우고, 뒤의 것은 앞의 영수증을 본다.
// 같은 본문은 둘 다 성공하고 지출·결재 기록·영수증이 하나뿐이다. 다른 본문은 둘째가 COMMAND_REUSED이고 첫 지출은 그대로다.
// PGlite는 거래를 하나씩 돌려 겹침을 증명하지 못한다. 시험은 준비와 판정의 모양만 본다.
type SameExpense = { label: string; holding: boolean; changed: boolean }
const EXPENSE_ROUNDS: readonly SameExpense[] = [
  { label: '같은 본문, 먼저 잠근 쪽이 기다리는 동안', holding: true, changed: false },
  { label: '같은 본문, 동시에 시작', holding: false, changed: false },
  { label: '다른 본문, 먼저 잠근 쪽이 기다리는 동안', holding: true, changed: true },
]
const EXPENSE_WON = 12000

function spendAs(
  db: Db,
  run: { context: SmokeContext; scene: MoneyScene },
  input: { commandId: string; description: string; amount: number },
  hold?: () => Promise<void>,
) {
  return changer(
    db,
    run.context,
    run.scene.finance[0],
  )('council.view', async (tx, actor) => {
    const detail = await createExpense(
      tx,
      actor,
      {
        ...input,
        vendor: '문구점',
        eventId: null,
        sourceMessageId: null,
        paidOn: koreanDateOf(run.context.now),
        method: 'card',
        paidBy: null,
        reason: null,
        budgetItemId: null,
        requestedBy: null,
        accountId: null,
        lines: [],
      },
      { now: run.context.now, receiptKey: SMOKE_RECEIPT_KEY },
    )
    await hold?.()
    return detail
  })
}

// 번호 하나에 지출 하나, 그 결재 기록 하나, 영수증 하나뿐인지
async function expenseSavedProblem(main: SmokeConnection, commandId: string, description: string) {
  const [saved] = await main.sql.unsafe(
    `SELECT (SELECT count(*) FROM expense WHERE description = $2)::text AS expenses,
            (SELECT count(*) FROM approval a JOIN expense e ON e.id = a.target_id WHERE e.description = $2)::text AS approvals,
            (SELECT count(*) FROM command_receipt c JOIN expense e ON e.id = c.result_id
              WHERE c.command_id = $1 AND c.kind = 'expense_create')::text AS receipts`,
    [commandId, description],
  )
  const seen = [saved?.expenses, saved?.approvals, saved?.receipts].join('/')
  return seen === '1/1/1' ? undefined : `지출/결재 기록/영수증 ${seen}(모두 1이어야 한다)`
}

async function sameExpenseRound(
  open: () => SmokeConnection,
  run: { context: SmokeContext; scene: MoneyScene; main: SmokeConnection },
  round: SameExpense,
) {
  const commandId = randomUUID()
  const first = { commandId, description: `점검 같은 명령 ${commandId}`, amount: EXPENSE_WON }
  const second = round.changed ? { ...first, amount: EXPENSE_WON + 1 } : first
  const [one, two] = (await warmed(open, PAIR)) as [Db, Db]
  const results = round.holding
    ? await raceHolding(hold => spendAs(one, run, first, hold), [() => spendAs(two, run, second)])
    : await Promise.allSettled([spendAs(one, run, first), spendAs(two, run, second)])
  const bad = unexpectedFailures(results, new Set(['COMMAND_REUSED']))
  if (bad.length > 0) return fail(`${round.label}: 예상하지 못한 오류로 끝났다`, bad[0])
  const problem =
    outcomeProblem(results, round.changed ? ['ok', 'COMMAND_REUSED'] : ['ok', 'ok']) ??
    (await expenseSavedProblem(run.main, commandId, first.description))
  return problem ? fail(`${round.label}: ${problem}`) : undefined
}

export const sameExpenseTogetherCase: SmokeCase = {
  name: '같은 지출 명령을 동시에 두 번',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'cx')
      for (const round of EXPENSE_ROUNDS) {
        const found = await sameExpenseRound(open, { context, scene, main }, round)
        if (found) return found
      }
      return pass(`${EXPENSE_ROUNDS.length}가지 모두 지출·결재 기록·영수증이 하나만 남았다`)
    }),
}
