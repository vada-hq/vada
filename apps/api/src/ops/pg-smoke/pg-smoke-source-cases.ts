import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import { inCouncilNoticeRoom } from '../../chat/plan-room.js'
import { sendAs } from '../../chat/send.js'
import { chatRoom, record } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { createExpense } from '../../expenses/service.js'
import { createPurchaseRequest } from '../../purchases/service.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  fail,
  pass,
  unexpectedFailures,
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

// 022 조각 5: 같은 메시지로 요청 둘(또는 지출 둘)이 동시에 온다. 라우트처럼 학생회 행 잠금(inCouncilChange) 뒤에
// 근거 잇기(chat/source-message.ts)가 메시지 행을 잠그고 그 메시지의 연결을 다시 읽는다.
// 기대: 먼저 잠근 쪽만 성공하고 뒤의 것은 SOURCE_MESSAGE_USED, 그 메시지의 연결은 하나다.
// 지금 길에서는 학생회 행 잠금이 먼저 줄을 세우므로 이 경우는 두 잠금을 합친 결과를 본다. 메시지 행 잠금만의
// 효과는 증명하지 않는다(학생회 행을 잠그지 않는 길을 위한 방어). 거래의 처음 스냅숏으로 읽으면(REPEATABLE READ)
// 둘 다 지나가 연결이 둘이 된다.

const EXPECTED = new Set(['SOURCE_MESSAGE_USED'])
const OUTCOMES = ['ok', 'SOURCE_MESSAGE_USED'] as const
const RACERS = 2
const EXPENSE_AMOUNT = 9000

type Kind = 'request' | 'expense'
type Run = { main: SmokeConnection; context: SmokeContext; scene: MoneyScene }

// 요청한 사람이 공지방에 보낸 메시지. 같은 날 들어온 재정부원 둘도 그 메시지를 본다(공지방, 같은 기수).
async function sourceMessageOf(run: Run) {
  const { main, context, scene } = run
  const [room] = await main.db
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(and(eq(record.councilId, scene.host.councilId), inCouncilNoticeRoom))
  if (!room) throw new Error('Notice room missing')
  const request = { ...scene.requester, action: 'council.view' as const, now: context.now }
  const input = { roomId: room.id, body: '마커 사 주세요', mentions: [], photos: [] }
  const sent = await main.db.transaction(tx => sendAs(tx, request, input))
  return sent.id
}

const requestFrom = (sourceMessageId: string) => ({
  title: '마커',
  eventId: null,
  requestedBy: null,
  sourceMessageId,
  body: null,
  neededBy: null,
  items: [{ name: '마커', quantity: 1, link: null, options: null }],
})

const expenseFrom = (sourceMessageId: string, now: Date) => ({
  commandId: randomUUID(),
  vendor: '문구점',
  eventId: null,
  sourceMessageId,
  description: '마커',
  amount: EXPENSE_AMOUNT,
  paidOn: koreanDateOf(now),
  method: 'card' as const,
  paidBy: null,
  reason: null,
  budgetItemId: null,
  requestedBy: null,
  accountId: null,
  lines: [],
})

// 요청은 요청한 사람이, 지출은 재정부원 하나씩 낸다. hold가 있으면 만든 뒤 잠금을 쥐고 기다린다.
function make(
  db: Db,
  run: Run,
  step: { kind: Kind; who: Who; messageId: string },
  hold?: () => Promise<void>,
) {
  const { context } = run
  return changer(
    db,
    context,
    step.who,
  )('council.view', async (tx, actor) => {
    if (step.kind === 'request')
      await createPurchaseRequest(tx, actor, requestFrom(step.messageId), context.now)
    else
      await createExpense(tx, actor, expenseFrom(step.messageId, context.now), {
        now: context.now,
        receiptKey: SMOKE_RECEIPT_KEY,
      })
    await hold?.()
  })
}

async function linksOf(run: Run, kind: Kind, messageId: string) {
  const [row] = await run.main.sql.unsafe(
    `SELECT count(*)::text AS n FROM evidence_link l JOIN record r ON r.id = l.record_id
      WHERE l.message_id = $1 AND r.kind = $2`,
    [messageId, kind],
  )
  return Number(row?.n)
}

function sameSourceCase(kind: Kind, tag: string, label: string): SmokeCase {
  return {
    name: `같은 메시지로 ${label} 둘을 동시에`,
    run: context =>
      withConnections(context, async open => {
        const main = open()
        const run = { main, context, scene: await moneyScene(main, context, tag) }
        const messageId = await sourceMessageOf(run)
        const { requester, finance } = run.scene
        const who: readonly [Who, Who] = kind === 'request' ? [requester, requester] : finance
        const [first, second] = (await warmed(open, RACERS)) as [Db, Db]
        const results = await raceHolding(
          hold => make(first, run, { kind, who: who[0], messageId }, hold),
          [() => make(second, run, { kind, who: who[1], messageId })],
        )
        const bad = unexpectedFailures(results, EXPECTED)
        if (bad.length > 0) return fail(`${label}가 예상하지 못한 오류로 끝났다`, bad[0])
        const problem = outcomeProblem(results, OUTCOMES)
        if (problem) return fail(problem)
        const links = await linksOf(run, kind, messageId)
        return links === 1
          ? pass(`${label}는 하나만 생기고 뒤의 것은 SOURCE_MESSAGE_USED였다`)
          : fail(`그 메시지의 ${label} 연결이 ${links}개(1개여야 한다)`)
      }),
  }
}

export const sameSourceRequestsCase = sameSourceCase('request', 'msgr', '구매 요청')
export const sameSourceExpensesCase = sameSourceCase('expense', 'msge', '지출')
