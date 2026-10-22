import { koreanDateOf, type CreateAccountRequest } from '@vada/contracts'
import { closeAccount, createAccount } from '../../accounts/service.js'
import type { Db } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import type { SmokeSql } from './pg-smoke-connection.js'
import {
  changer,
  fail,
  pass,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'
import { moneyScene, outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'
import type { MoneyScene } from './pg-smoke-money-kit.js'

// 계좌(기능 006 조각 5)의 동시 처리 사례 a. 서비스 함수를 라우트와 같은 잠금(inCouncilChange)으로 불러 운영과 같은 길을 탄다.
// 모든 쓰기가 학생회 행 잠금을 먼저 거치므로, 이 사례가 증명하는 것은 학생회 행 잠금과 READ COMMITTED 다시 읽기다.
// 그 둘이 없으면 닫지 않은 대표 계좌가 둘 생기려 하거나(DB 유일 인덱스가 막는 마지막 보루에 기대게 된다),
// 닫은 계좌로 지출이 적힌다.

const EXPECTED = new Set(['MAIN_ACCOUNT_EXISTS', 'ACCOUNT_INVALID'])
const RACERS = 3
const PAIR = 2
const EXPENSE_AMOUNT = 8000

const accountOf = (name: string): CreateAccountRequest => ({
  name,
  bank: '점검은행',
  accountNumber: '123-456-789',
  holder: '점검 예금주',
  type: 'main',
})

type Run = { context: SmokeContext; scene: MoneyScene; sql: SmokeSql }

const creating = (db: Db, run: Run, name: string, hold?: () => Promise<void>) =>
  changer(
    db,
    run.context,
    run.scene.finance[0],
  )('council.view', async (tx, actor) => {
    const created = await createAccount(tx, actor, accountOf(name))
    await hold?.()
    return created
  })

async function openMainCount(sql: SmokeSql, councilId: string) {
  const rows = await sql.unsafe(
    `SELECT count(*)::int AS n FROM account WHERE council_id = $1 AND type = 'main' AND closed_on IS NULL`,
    [councilId],
  )
  return Number(rows[0]?.n)
}

// 먼저 잠근 쪽이 잠근 채 기다릴 때 들어오는 둘과, 아무도 기다리지 않고 동시에 시작한 셋 모두 하나만 된다.
async function mainTogether(open: Parameters<typeof warmed>[0], run: Run) {
  const councilId = run.scene.finance[0].councilId
  const [holder, ...rest] = await warmed(open, RACERS)
  const held = await raceHolding(
    hold => creating(holder!, run, '대표 하나', hold),
    rest.map((db, index) => () => creating(db, run, `대표 후보 ${index}`)),
  )
  const heldBad = unexpectedFailures(held, EXPECTED)
  if (heldBad.length > 0) return fail('대표 계좌 만들기가 예상하지 못한 오류로 끝났다', heldBad[0])
  const problem = outcomeProblem(held, ['ok', ...rest.map(() => 'MAIN_ACCOUNT_EXISTS')])
  if (problem) return fail(`먼저 잠근 쪽이 있을 때: ${problem}`)
  if ((await openMainCount(run.sql, councilId)) !== 1)
    return fail('먼저 잠근 쪽이 있을 때: 닫지 않은 대표 계좌가 하나가 아니다')
  // 이미 있는 대표를 닫으면 같은 일을 한 번 더 겨룰 수 있다.
  const [existing] = await run.sql.unsafe(
    `SELECT id FROM account WHERE council_id = $1 AND closed_on IS NULL`,
    [councilId],
  )
  await changer(
    holder!,
    run.context,
    run.scene.finance[0],
  )('council.view', (tx, actor) =>
    closeAccount(tx, actor, { accountId: String(existing?.id), now: run.context.now }),
  )
  const plain = await warmed(open, RACERS)
  const together = await Promise.allSettled(
    plain.map((db, index) => creating(db, run, `동시 대표 ${index}`)),
  )
  const plainBad = unexpectedFailures(together, EXPECTED)
  if (plainBad.length > 0)
    return fail('동시에 시작한 대표 계좌 만들기가 예상하지 못한 오류로 끝났다', plainBad[0])
  const winners = together.filter(result => result.status === 'fulfilled').length
  if (winners !== 1) return fail(`동시에 시작했을 때 ${winners}개가 만들어졌다(기대 1개)`)
  return (await openMainCount(run.sql, councilId)) === 1
    ? undefined
    : fail('동시에 시작했을 때 닫지 않은 대표 계좌가 하나가 아니다')
}

export const mainAccountTogetherCase: SmokeCase = {
  name: '대표 계좌를 동시에 만들기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'o')
      const problem = await mainTogether(open, { context, scene, sql: main.sql })
      return (
        problem ?? pass('먼저 잠근 쪽이 있을 때도 동시에 시작해도 닫지 않은 대표 계좌는 하나뿐이다')
      )
    }),
}

// 지출을 적는다. 계좌를 쓰면 같은 학생회의 닫지 않은 계좌여야 한다(ACCOUNT_INVALID).
const spending = (db: Db, run: Run, accountId: string, hold?: () => Promise<void>) =>
  changer(
    db,
    run.context,
    run.scene.finance[1],
  )('council.view', async (tx, actor) => {
    const detail = await createExpense(
      tx,
      actor,
      {
        vendor: '문구점',
        eventId: null,
        description: '계좌 점검',
        amount: EXPENSE_AMOUNT,
        paidOn: koreanDateOf(run.context.now),
        method: 'card',
        paidBy: null,
        reason: null,
        budgetItemId: null,
        requestedBy: null,
        accountId,
        lines: [],
      },
      run.context.now,
    )
    await hold?.()
    return detail
  })

const closing = (db: Db, run: Run, accountId: string, hold?: () => Promise<void>) =>
  changer(
    db,
    run.context,
    run.scene.finance[0],
  )('council.view', async (tx, actor) => {
    const closed = await closeAccount(tx, actor, { accountId, now: run.context.now })
    await hold?.()
    return closed
  })

async function expensesOn(sql: SmokeSql, accountId: string) {
  const rows = await sql.unsafe(`SELECT count(*)::int AS n FROM expense WHERE account_id = $1`, [
    accountId,
  ])
  return Number(rows[0]?.n)
}

// 닫기가 먼저면 지출은 거절되어 하나도 남지 않고, 지출이 먼저면 둘 다 되어 닫기 전 지출이 계좌를 가진다.
async function closeAndSpend(open: Parameters<typeof warmed>[0], run: Run) {
  const scenarios = [
    { label: '닫기가 먼저', closeFirst: true, outcomes: ['ok', 'ACCOUNT_INVALID'], expenses: 0 },
    { label: '지출이 먼저', closeFirst: false, outcomes: ['ok', 'ok'], expenses: 1 },
  ]
  for (const [index, scenario] of scenarios.entries()) {
    const [first, second] = await warmed(open, PAIR)
    const account = await creating(first!, run, `겹침 ${index}`)
    // 대표를 닫은 뒤 다음 사례가 같은 학생회에서 새 대표를 만든다.
    const results = await raceHolding(
      hold =>
        scenario.closeFirst
          ? closing(first!, run, account.id, hold)
          : spending(first!, run, account.id, hold),
      [
        () =>
          scenario.closeFirst
            ? spending(second!, run, account.id)
            : closing(second!, run, account.id),
      ],
    )
    const bad = unexpectedFailures(results, EXPECTED)
    if (bad.length > 0) return fail('계좌 닫기와 지출이 예상하지 못한 오류로 끝났다', bad[0])
    const problem = outcomeProblem(results, scenario.outcomes)
    if (problem) return fail(`${scenario.label}: ${problem}`)
    const written = await expensesOn(run.sql, account.id)
    if (written !== scenario.expenses)
      return fail(`${scenario.label}: 이 계좌의 지출 ${written}개(기대 ${scenario.expenses}개)`)
  }
  return undefined
}

export const closeAndSpendCase: SmokeCase = {
  name: '계좌 닫기와 그 계좌로 지출 적기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'p')
      const problem = await closeAndSpend(open, { context, scene, sql: main.sql })
      return (
        problem ??
        pass(
          '닫기가 먼저면 지출이 거절되고, 지출이 먼저면 둘 다 되며, 닫은 계좌에 몰래 적힌 지출이 없다',
        )
      )
    }),
}
