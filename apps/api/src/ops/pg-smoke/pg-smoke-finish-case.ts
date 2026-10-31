import { randomUUID } from 'node:crypto'
import { koreanDateOf } from '@vada/contracts'
import type { Db } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import { decideLineItems } from '../../purchases/decide.js'
import { createPurchaseRequest } from '../../purchases/service.js'
import { createTask } from '../../tasks/service.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  fail,
  memberIdOf,
  pass,
  unexpectedFailures,
  versionsOf,
  withConnections,
  type SmokeCase,
  type SmokeContext,
  type Who,
  SMOKE_RECEIPT_KEY,
} from './pg-smoke-kit.js'
import {
  moneyScene,
  outcomeProblem,
  raceHolding,
  warmed,
  type MoneyScene,
} from './pg-smoke-money-kit.js'

// 사례 r(기능 015): 이어진 요청의 마지막 두 품목을 두 재정부원이 동시에 결제해도 업무가 한 번만 끝난다.
// 지출 적기는 학생회 행 잠금 아래에서 한 줄로 서므로, 뒤의 거래가 앞의 결제 내역을 다시 읽어 끝남을 놓치지 않고 두 번 옮기지도 않는다.
// 기대: 두 결제 모두 성공, 업무는 done, 바꾼 사람 없는 request_finished 판이 하나, 업무의 판은 만듦·진행 중·끝남 셋이다.

const ROUNDS = 3
const PAID = 5000
const ITEM_COUNT = 2
// 업무의 판: 만들 때, 요청을 이을 때(진행 중), 끝남
const TASK_VERSIONS = 3

type Run = { main: SmokeConnection; open: () => SmokeConnection; context: SmokeContext }

// 요청한 사람이 맡은 업무를 회장이 만든다.
async function taskOf(run: Run, scene: MoneyScene, round: number) {
  const { main, context } = run
  const assigneeId = await memberIdOf(main.db, scene.requester.userId)
  const { task } = await changer(
    main.db,
    context,
    scene.host,
  )('task.manage', (tx, actor) =>
    createTask(
      tx,
      actor,
      {
        title: `업무 ${round}`,
        body: null,
        dueDate: null,
        departmentId: null,
        assigneeId,
        eventId: null,
      },
      context.now,
    ),
  )
  return task.id
}

// 요청한 사람이 그 업무에 이어 품목 둘짜리 요청을 낸다.
async function requestOf(run: Run, scene: MoneyScene, taskId: string, round: number) {
  const { context } = run
  const { request } = await changer(
    run.main.db,
    context,
    scene.requester,
  )('council.view', (tx, actor) =>
    createPurchaseRequest(
      tx,
      actor,
      {
        title: `마지막 둘 ${round}`,
        eventId: null,
        requestedBy: null,
        sourceMessageId: null,
        body: null,
        neededBy: null,
        taskId,
        items: Array.from({ length: ITEM_COUNT }, (_, index) => ({
          name: `마커 ${index}`,
          quantity: 1,
          link: null,
          options: null,
        })),
      },
      { now: context.now, receiptKey: SMOKE_RECEIPT_KEY },
    ),
  )
  return request
}

// 재정부원이 두 품목을 모두 승인한다.
async function approvedPair(run: Run, scene: MoneyScene, round: number) {
  const { main, context } = run
  const taskId = await taskOf(run, scene, round)
  const request = await requestOf(run, scene, taskId, round)
  const itemIds = request.items.map(item => item.id)
  await changer(
    main.db,
    context,
    scene.finance[0],
  )('council.view', (tx, actor) =>
    decideLineItems(tx, actor, request.id, {
      now: context.now,
      input: {
        decisions: itemIds.map(lineItemId => ({
          lineItemId,
          outcome: 'approved' as const,
          amount: PAID,
          budgetItemId: scene.budgetItemId,
        })),
      },
    }),
  )
  return { taskId, itemIds }
}

const payAs = (run: Run, as: { db: Db; who: Who }, itemId: string, hold?: () => Promise<void>) =>
  changer(
    as.db,
    run.context,
    as.who,
  )('council.view', async (tx, actor) => {
    await createExpense(
      tx,
      actor,
      {
        commandId: randomUUID(),
        vendor: '문구점',
        eventId: null,
        sourceMessageId: null,
        description: '점검',
        amount: PAID,
        paidOn: koreanDateOf(run.context.now),
        method: 'card',
        paidBy: null,
        reason: null,
        budgetItemId: null,
        requestedBy: null,
        accountId: null,
        lines: [{ lineItemId: itemId, amount: PAID }],
      },
      { now: run.context.now, receiptKey: SMOKE_RECEIPT_KEY },
    )
    await hold?.()
  })

async function finishedBy(main: SmokeConnection, taskId: string) {
  const [row] = await main.sql.unsafe(
    `SELECT count(*)::text AS n FROM record_version
      WHERE record_id = $1 AND reason = 'request_finished' AND changed_by IS NULL`,
    [taskId],
  )
  return Number(row?.n)
}

async function finishRound(run: Run, scene: MoneyScene, round: number) {
  const { main, open } = run
  const { taskId, itemIds } = await approvedPair(run, scene, round)
  const [first, second] = (await warmed(open, ITEM_COUNT)) as [Db, Db]
  const results = await raceHolding(
    hold => payAs(run, { db: first, who: scene.finance[0] }, itemIds[0]!, hold),
    [() => payAs(run, { db: second, who: scene.finance[1] }, itemIds[1]!)],
  )
  const bad = unexpectedFailures(results, new Set())
  if (bad.length > 0) return fail('결제가 예상하지 못한 오류로 끝났다', bad[0])
  const problem = outcomeProblem(results, ['ok', 'ok'])
  if (problem) return fail(`${round}번째: ${problem}`)
  const versions = await versionsOf(main.sql, taskId)
  const finished = await finishedBy(main, taskId)
  return versions.last.status === 'done' &&
    versions.count === TASK_VERSIONS &&
    versions.open === 1 &&
    finished === 1
    ? undefined
    : fail(
        `${round}번째: 업무 상태 ${String(versions.last.status)}, 판 ${versions.count}개, 끝남 판 ${finished}개(done, ${TASK_VERSIONS}개, 1개여야 한다)`,
      )
}

export const finishTogetherCase: SmokeCase = {
  name: '이어진 요청의 마지막 두 품목을 동시에 결제',
  run: context =>
    withConnections(context, async open => {
      const run = { main: open(), open, context }
      const scene = await moneyScene(run.main, context, 'fin')
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await finishRound(run, scene, round)
        if (problem) return problem
      }
      return pass(`${ROUNDS}번 모두 두 결제가 되고 업무는 한 번만 끝남이 됐다`)
    }),
}
