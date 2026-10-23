import {
  dateFromKorean,
  koreanDateOf,
  type CreateExpense,
  type ExpenseDetail,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { assertUsableAccount } from '../accounts/queries.js'
import { can } from '../access/permissions.js'
import { assertCurrentExpenseItems, budgetItemEventsOf } from '../budget/queries.js'
import { assertCurrentMembers } from '../chat/current-members.js'
import { linkSourceMessage } from '../chat/source-message.js'
import { assertDayOpen } from '../closing/lock.js'
import type { Tx } from '../db/types.js'
import { assertEventsOpen } from '../events/completion.js'
import { assertCouncilEvent } from '../events/council-event.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { assertExpenseEventOpen, eventsOfLines, requestEventsOfLines } from './event-lock.js'
import { assertEventMatchesItem, eventFilledFromItem, eventOfNewExpense } from './event-rule.js'
import { assertPayable } from './payable.js'
import { lockedExpenseRow } from './lock.js'
import { expenseDetailOf } from './queries.js'
import { canCancelExpense, canReimburse } from './status.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 지출 행 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 재정부만 쓴다(회장단도 403). 403이 다른 실패보다 먼저다.

// 완료한 행사의 기록은 잠겼다. 결제하는 품목 요청의 행사, 고른 예산 항목의 행사, 적는 행사를 본다(DEC-68).
// 품목을 낸 요청들의 행사를 돌려줘 지출의 행사를 정하는 데 쓴다.
async function assertEventsOpenFor(tx: Tx, actor: Actor, input: CreateExpense) {
  const itemIds = input.lines.map(line => line.lineItemId)
  await assertEventsOpen(tx, [
    ...(await eventsOfLines(tx, actor, itemIds)),
    input.eventId,
    ...(input.budgetItemId ? await budgetItemEventsOf(tx, actor, [input.budgetItemId]) : []),
  ])
  return requestEventsOfLines(tx, actor, itemIds)
}

async function assertInputAllowed(tx: Tx, actor: Actor, input: CreateExpense, now: Date) {
  // 결제일은 오늘(한국)까지다. 오늘 23:59:59는 받고 내일은 받지 않는다.
  if (input.paidOn > koreanDateOf(now)) throw new ApiError('INVALID_INPUT')
  await assertCurrentMembers(tx, actor.councilId, [input.paidBy, input.requestedBy], now)
  if (input.budgetItemId) await assertCurrentExpenseItems(tx, actor, [input.budgetItemId], now)
  // 학생회 행을 잠근 뒤에 읽으므로 계좌 닫기와 겹쳐도 하나로 정해진다.
  if (input.accountId) await assertUsableAccount(tx, actor, input.accountId)
  await assertPayable(
    tx,
    actor,
    input.lines.map(line => line.lineItemId),
  )
}

// 결제일은 그날 한국 0시로 저장한다.
function expenseValuesOf(input: CreateExpense, eventId: string | null) {
  return {
    amount: String(input.amount),
    paidAt: dateFromKorean(`${input.paidOn}T00:00`),
    description: input.description,
    vendor: input.vendor,
    method: input.method,
    reason: input.reason,
    eventId,
    budgetItemId: input.budgetItemId,
    requestedBy: input.requestedBy,
    paidBy: input.paidBy,
    accountId: input.accountId,
  }
}

// 지출을 적으면 같은 거래에서 적은 사람의 승인 결재 기록이 생긴다(DEC-41). 따로 결재하는 단계는 없다.
export async function createExpense(
  tx: Tx,
  actor: Actor,
  input: CreateExpense,
  now: Date,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  // 다른 학생회 행사(409 EVENT_INVALID)를 먼저 걸러야 잠금 확인이 그 행사의 완료 여부를 드러내지 않는다.
  await assertCouncilEvent(tx, actor, input.eventId)
  const requested = eventOfNewExpense(await assertEventsOpenFor(tx, actor, input), input.eventId)
  // 결제일이 든 기간을 공개했으면 적지 못한다(DEC-70). 행사 완료 잠금 뒤에 본다.
  await assertDayOpen(tx, actor, input.paidOn)
  const itemEvents = input.budgetItemId
    ? await budgetItemEventsOf(tx, actor, [input.budgetItemId])
    : []
  assertEventMatchesItem(itemEvents, requested)
  const eventId = eventFilledFromItem(itemEvents, requested)
  await assertInputAllowed(tx, actor, input, now)
  const expenseId = await createRecord(tx, {
    kind: 'expense',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: expenseValuesOf(input, eventId),
  })
  await linkSourceMessage(tx, actor, expenseId, input.sourceMessageId)
  for (const line of input.lines)
    await createRecord(tx, {
      kind: 'payment_line',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { expenseId, lineItemId: line.lineItemId, amount: String(line.amount) },
    })
  await createRecord(tx, {
    kind: 'approval',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      targetId: expenseId,
      targetKind: 'expense',
      outcome: 'approved',
      actorId: actor.memberId,
      actorKind: 'member',
      actedAt: clockNow,
      reason: null,
    },
  })
  return expenseDetailOf(tx, actor, expenseId)
}

const factsOf = (row: Awaited<ReturnType<typeof lockedExpenseRow>>) => ({
  cancelled: row.cancelledAt !== null,
  paidBy: row.paidById,
  reimbursed: row.reimbursedAt !== null,
})

// 취소는 지우지 않고 취소한 시각을 채운다. 사유는 판에 남는다. 이미 취소했으면 409다.
export async function cancelExpense(
  tx: Tx,
  actor: Actor,
  expenseId: string,
  reason: string,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedExpenseRow(tx, actor, expenseId)
  await assertExpenseEventOpen(tx, actor, expenseId)
  // 결제일이 든 기간을 공개했으면 취소하지 못한다(DEC-70). 증빙·사유·환급은 열어 둔다.
  await assertDayOpen(tx, actor, koreanDateOf(row.paidAt))
  if (!canCancelExpense(actor, factsOf(row))) throw new ApiError('EXPENSE_CANCELLED')
  await updateRecord(tx, {
    kind: 'expense',
    id: expenseId,
    actor: actor.memberId,
    reason,
    changes: { cancelledAt: clockNow },
  })
  return expenseDetailOf(tx, actor, expenseId)
}

// 환급은 먼저 낸 사람이 있고 취소되지 않은 지출에 한 번 표시하고 되돌리지 않는다.
export async function reimburseExpense(
  tx: Tx,
  actor: Actor,
  expenseId: string,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedExpenseRow(tx, actor, expenseId)
  await assertExpenseEventOpen(tx, actor, expenseId)
  if (!canReimburse(actor, factsOf(row))) throw new ApiError('NOT_REIMBURSABLE')
  await updateRecord(tx, {
    kind: 'expense',
    id: expenseId,
    actor: actor.memberId,
    reason: null,
    changes: { reimbursedAt: clockNow },
  })
  return expenseDetailOf(tx, actor, expenseId)
}
