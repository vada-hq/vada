import { and, asc, eq, inArray } from 'drizzle-orm'
import type { DecideLineItems, PurchaseRequestDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { currentPeriodOf } from '../budget/queries.js'
import { approval, budgetItem, lineItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { lockedRequestRow } from './lock.js'
import { requestDetailOf, requestRowOf } from './queries.js'
import type { PurchaseNotice } from './service.js'

type Decision = DecideLineItems['decisions'][number]

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

async function decidedAmong(tx: Tx, ids: string[]) {
  const rows = await tx
    .select({ id: approval.targetId })
    .from(approval)
    .where(and(eq(approval.targetKind, 'line_item'), inArray(approval.targetId, ids)))
  return rows.length > 0
}

// 승인에 고른 예산 항목은 오늘(한국)이 든 이 학생회 회계 기간의 지출 항목이어야 한다. 기간은 예산 모듈의 같은 규칙(currentPeriodOf)으로 찾는다.
async function assertBudgetItems(tx: Tx, actor: Actor, decisions: Decision[], now: Date) {
  const ids = [
    ...new Set(decisions.flatMap(item => (item.outcome === 'approved' ? [item.budgetItemId] : []))),
  ]
  if (!ids.length) return
  const period = await currentPeriodOf(tx, actor, now)
  if (!period) throw new ApiError('BUDGET_ITEM_INVALID')
  const rows = await tx
    .select({ id: budgetItem.id })
    .from(budgetItem)
    .where(
      and(
        inArray(budgetItem.id, ids),
        eq(budgetItem.budgetId, period.budgetId),
        eq(budgetItem.type, 'expense'),
      ),
    )
  if (rows.length !== ids.length) throw new ApiError('BUDGET_ITEM_INVALID')
}

async function writeDecision(tx: Tx, actor: Actor, item: Decision) {
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
      reason: item.outcome === 'rejected' ? item.reason : null,
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
  const pendingAfter = after.items - after.approved - after.rejected
  if (pendingBefore === 0 || pendingAfter > 0 || after.requestedBy === actor.memberId) return null
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
  if (row.cancelledAt) throw new ApiError('REQUEST_CLOSED')
  const own = await lockedItemIds(tx, requestId)
  const ids = input.decisions.map(item => item.lineItemId)
  // 다른 요청이나 다른 학생회의 품목도 이 요청에서는 결재할 수 없는 품목이다.
  if (ids.some(id => !own.has(id)) || (await decidedAmong(tx, ids)))
    throw new ApiError('LINE_ITEM_DECIDED')
  await assertBudgetItems(tx, actor, input.decisions, now)
  for (const item of input.decisions) await writeDecision(tx, actor, item)
  const pendingBefore = row.items - row.approved - row.rejected
  const notice = await noticeResult(tx, actor, requestId, { pendingBefore, now })
  return { request: await requestDetailOf(tx, actor, requestId), notice }
}
