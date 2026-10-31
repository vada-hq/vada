import { asc, eq, inArray, sql } from 'drizzle-orm'
import { eventsAgree, type DecideLineItems, type PurchaseRequestDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { assertCurrentExpenseItems, budgetItemEventMap } from '../budget/queries.js'
import { lineItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { assertEventsOpen } from '../events/completion.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { lastOutcomeOf } from './last-outcome.js'
import { lockedRequestRow } from './lock.js'
import { overBudgetReasons } from './over-budget.js'
import { decide, factsOf } from './policy.js'
import { requestDetailOf, requestRowOf } from './queries.js'
import type { PurchaseNotice } from './service.js'

type Decision = DecideLineItems['decisions'][number]

// 승인하며 고른 예산 항목의 행사. 완료한 행사의 예산 항목은 결재에서 고를 수 없다(DEC-68).
async function budgetItemEvents(tx: Tx, actor: Actor, decisions: Decision[]) {
  const ids = decisions.flatMap(item => (item.outcome === 'approved' ? [item.budgetItemId] : []))
  return budgetItemEventMap(tx, actor, ids)
}

// 요청의 행사와 승인하며 고른 예산 항목의 행사가 둘 다 있는데 다르면 409다(DEC-81). 하나라도 어긋나면 모두 쓰지 않는다.
function assertEventsBelong(requestEventId: string | null, itemEvents: Map<string, string | null>) {
  for (const eventId of itemEvents.values())
    if (!eventsAgree(requestEventId, eventId)) throw new ApiError('EVENT_MISMATCH')
}

// 이 요청의 품목을 id 순으로 잠근다. 같은 품목을 동시에 결재하는 거래는 여기서 한 줄로 서고, 뒤 거래는 앞 거래가 남긴 결재 기록을 본다.
async function lockedItemIds(tx: Tx, requestId: string) {
  const rows = await tx
    .select({ id: lineItem.id })
    .from(lineItem)
    .where(eq(lineItem.requestId, requestId))
    .orderBy(asc(lineItem.id))
    .for('no key update')
  return new Set(rows.map(row => row.id))
}

// 마지막 결과가 있는(결재·취소된) 품목이 하나라도 있는가
async function decidedAmong(tx: Tx, ids: string[]) {
  const rows = await tx
    .select({ id: lineItem.id })
    .from(lineItem)
    .where(sql`${inArray(lineItem.id, ids)} and ${lastOutcomeOf(lineItem.id)} is not null`)
  return rows.length > 0
}

// 승인의 사유는 서버가 정한 예산 초과 기록뿐이다. 계약은 승인에 사유를 받지 않는다.
async function writeDecision(
  tx: Tx,
  actor: Actor,
  item: Decision,
  overBudget: Map<string, string>,
) {
  if (item.outcome === 'approved')
    await updateRecord(tx, {
      kind: 'line_item',
      id: item.lineItemId,
      actor: actor.memberId,
      reason: null,
      changes: { amount: String(item.amount), budgetItemId: item.budgetItemId },
    })
  await createRecord(tx, {
    kind: 'approval',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      targetId: item.lineItemId,
      targetKind: 'line_item',
      outcome: item.outcome,
      actorId: actor.memberId,
      actorKind: 'member',
      actedAt: clockNow,
      reason:
        item.outcome === 'rejected' ? item.reason : (overBudget.get(item.budgetItemId) ?? null),
    },
  })
}

// 마지막 대기 품목이 결재됐고 결재한 사람이 요청한 사람이 아니면, 요청한 사람(지금도 운영진이면)에게 알림 기록 하나를 남긴다.
async function noticeResult(
  tx: Tx,
  actor: Actor,
  requestId: string,
  when: { pendingBefore: number; now: Date },
): Promise<PurchaseNotice | null> {
  const { pendingBefore, now } = when
  const after = await requestRowOf(tx, actor, requestId)
  if (pendingBefore === 0 || after.pending > 0 || after.requestedBy === actor.memberId) return null
  const alive = await currentMembersAmong(tx, actor.councilId, [after.requestedBy], now)
  if (!alive.has(after.requestedBy)) return null
  await createRecord(tx, {
    kind: 'notification',
    councilId: actor.councilId,
    actor: null,
    values: {
      recipientId: after.requestedBy,
      recordId: requestId,
      type: 'changed',
      notifiedAt: clockNow,
    },
  })
  return { requestId, recipientIds: [after.requestedBy], decidedBy: actor.memberId }
}

// 품목마다(또는 모두) 승인하거나 반려한다. 학생회 행 잠금과 운영진 확인 뒤에 부르고, 요청 행 → 품목 행 차례로 잠근다.
// 하나라도 안 되면 던져서 거래가 되돌아가므로 아무 기록도 남지 않는다. 403이 409보다 먼저다.
export async function decideLineItems(
  tx: Tx,
  actor: Actor,
  requestId: string,
  command: { input: DecideLineItems; now: Date },
): Promise<{ request: PurchaseRequestDetail; notice: PurchaseNotice | null }> {
  const { input, now } = command
  if (!can(actor, 'purchase.approve')) throw new ApiError('FORBIDDEN')
  const row = await lockedRequestRow(tx, actor, requestId)
  const itemEvents = await budgetItemEvents(tx, actor, input.decisions)
  await assertEventsOpen(tx, [row.eventId, ...itemEvents.values()])
  // 요청 단위의 판정(취소한 요청 REQUEST_CLOSED, 결재할 품목이 없으면 LINE_ITEM_DECIDED)은 읽기의 actions와 같은 decide다.
  const code = decide(actor, await factsOf(tx, row), 'purchase_request.decide')
  if (code) throw new ApiError(code)
  const own = await lockedItemIds(tx, requestId)
  const ids = input.decisions.map(item => item.lineItemId)
  // 다른 요청이나 다른 학생회의 품목도 이 요청에서는 결재할 수 없는 품목이다.
  if (ids.some(id => !own.has(id)) || (await decidedAmong(tx, ids)))
    throw new ApiError('LINE_ITEM_DECIDED')
  assertEventsBelong(row.eventId, itemEvents)
  await assertCurrentExpenseItems(
    tx,
    actor,
    input.decisions.flatMap(item => (item.outcome === 'approved' ? [item.budgetItemId] : [])),
    now,
  )
  const overBudget = await overBudgetReasons(tx, actor, input.decisions)
  for (const item of input.decisions) await writeDecision(tx, actor, item, overBudget)
  const notice = await noticeResult(tx, actor, requestId, { pendingBefore: row.pending, now })
  return { request: await requestDetailOf(tx, actor, requestId), notice }
}
