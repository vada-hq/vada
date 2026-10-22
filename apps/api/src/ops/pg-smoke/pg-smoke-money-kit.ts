import { and, eq, sql } from 'drizzle-orm'
import { koreanYearOf } from '@vada/contracts'
import { addBudgetItem, createFiscalPeriod } from '../../budget/service.js'
import { department } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { createPurchaseRequest } from '../../purchases/service.js'
import { assignDepartment } from '../../team/service.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  createdCouncil,
  HOLD_MS,
  googleUser,
  inviteCodeOf,
  joined,
  memberIdOf,
  outcomeOf,
  pause,
  type Who,
  type SmokeContext,
} from './pg-smoke-kit.js'

// 구매 요청과 지출(기능 005) 사례가 함께 쓰는 틀: 재정부원 둘과 요청한 사람이 있는 학생회, 그리고 "먼저 잠근 쪽이 확실히 잠근 뒤 다른 쪽이 시작"하는 순서 강제.

export type MoneyScene = {
  requester: Who
  finance: readonly [Who, Who]
  financeIds: readonly [string, string]
  budgetItemId: string
}

const BUDGET_AMOUNT = 100000
const BUDGET_ITEM = {
  purpose: '소모품',
  amount: BUDGET_AMOUNT,
  type: 'expense',
  eventId: null,
} as const

// 학생회 하나(재정 역할 부서는 학생회를 만들 때 함께 생긴다), 그 부서에 든 부원 둘, 요청만 내는 부원 하나, 오늘이 든 기간과 지출 예산 항목 하나.
// tag는 모든 사례가 한 점검 DB를 함께 쓰므로 다른 사례의 사용자 이름(smoke-<글자>-…)과 겹치지 않는 글자여야 한다. 겹치면 사용자 만들기가 23505로 멈춘다.
export async function moneyScene(
  main: SmokeConnection,
  context: SmokeContext,
  tag: string,
): Promise<MoneyScene> {
  const user = (name: string) => `smoke-${tag}-${name}`
  const [host, f1, f2, requester] = ['host', 'f1', 'f2', 'r'].map(user) as [
    string,
    string,
    string,
    string,
  ]
  for (const id of [host, f1, f2, requester]) await googleUser(main.db, id)
  const councilId = await createdCouncil(main.db, context, host, `점검 ${tag} 학생회`)
  const code = await inviteCodeOf(main.db, councilId)
  for (const id of [f1, f2, requester]) await joined(main.db, context, id, code)
  const hosting = changer(main.db, context, { userId: host, councilId })
  const [finance] = await main.db
    .select({ id: department.id })
    .from(department)
    .where(and(eq(department.councilId, councilId), eq(department.name, '재정부')))
  if (!finance) throw new Error('Department missing')
  const financeIds = [await memberIdOf(main.db, f1), await memberIdOf(main.db, f2)] as const
  for (const memberId of financeIds)
    await hosting('member.manage', (tx, actor) =>
      assignDepartment(tx, actor, { memberId, departmentId: finance.id, rank: null }),
    )
  const first = changer(main.db, context, { userId: f1, councilId })
  const year = koreanYearOf(context.now)
  await first('council.view', (tx, actor) =>
    createFiscalPeriod(tx, actor, {
      name: `${year}년`,
      startsOn: `${year}-01-01`,
      endsOn: `${year}-12-31`,
    }),
  )
  const budget = await first('council.view', (tx, actor) =>
    addBudgetItem(tx, actor, BUDGET_ITEM, context.now),
  )
  return {
    requester: { userId: requester, councilId },
    finance: [
      { userId: f1, councilId },
      { userId: f2, councilId },
    ],
    financeIds,
    budgetItemId: budget.items[0]!.id,
  }
}

// 요청한 사람이 품목 하나짜리 구매 요청을 낸다.
export async function purchaseOf(db: Db, context: SmokeContext, scene: MoneyScene, title: string) {
  const { request } = await changer(
    db,
    context,
    scene.requester,
  )('council.view', (tx, actor) =>
    createPurchaseRequest(
      tx,
      actor,
      {
        title,
        eventId: null,
        body: null,
        neededBy: null,
        items: [{ name: '마커', quantity: 1, link: null, options: null }],
      },
      context.now,
    ),
  )
  return { requestId: request.id, itemId: request.items[0]!.id }
}

// 동시에 움직일 연결을 미리 열고 한 번씩 써서 연결을 끝내 둔다. 순서 강제 뒤에 연결을 여는 시간이 끼지 않게 한다.
export async function warmed(open: () => SmokeConnection, count: number): Promise<Db[]> {
  const dbs = Array.from({ length: count }, () => open().db)
  await Promise.all(dbs.map(db => db.execute(sql`SELECT 1`)))
  return dbs
}

// first가 거래 안에서 쓰고 나서 hold()를 부르면 신호를 보내고 잠금을 쥔 채 잠시 기다린다. others는 그 신호 뒤에 시작하므로
// 먼저 잠근 쪽이 확실히 잠근 뒤에 들어온다. first가 실패해도 신호는 가므로 others가 영영 기다리지 않는다.
export function raceHolding(
  first: (hold: () => Promise<void>) => Promise<unknown>,
  others: readonly (() => Promise<unknown>)[],
): Promise<PromiseSettledResult<unknown>[]> {
  let signal = () => {}
  const started = new Promise<void>(resolve => {
    signal = resolve
  })
  const holding = first(async () => {
    signal()
    await pause(HOLD_MS)
  })
  void holding.then(signal, signal)
  const following = others.map(async run => {
    await started
    return run()
  })
  return Promise.allSettled([holding, ...following])
}

// 결과가 기대한 순서의 성공('ok')·오류 코드와 같은지 본다. 맞으면 undefined, 아니면 어긋난 모양.
// 첫째(먼저 잠근 쪽)부터 하나하나 맞추므로, 모두 성공하거나 모두 실패한 빈 통과가 없다.
export function outcomeProblem(
  results: readonly PromiseSettledResult<unknown>[],
  expected: readonly string[],
): string | undefined {
  const actual = results.map(outcomeOf)
  return actual.join(',') === expected.join(',')
    ? undefined
    : `결과가 ${actual.join(', ')}(기대 ${expected.join(', ')})`
}
