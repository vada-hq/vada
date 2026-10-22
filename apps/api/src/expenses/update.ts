import type { ExpenseDetail, UpdateExpense } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Tx } from '../db/types.js'
import { budgetItemEventsOf } from '../budget/queries.js'
import { assertEventsOpen } from '../events/completion.js'
import { assertCouncilEvent } from '../events/council-event.js'
import { ApiError } from '../http/errors.js'
import { updateRecord } from '../records/records.js'
import { eventsOfExpense, requestEventsOfExpense } from './event-lock.js'
import { assertEventMatchesItem, assertEventMatchesRequests } from './event-rule.js'
import { lockedExpenseRow } from './lock.js'
import { expenseDetailOf } from './queries.js'

// 바뀌는 칸만 모은다: 칸을 빼거나 지금과 같은 값이면 넣지 않는다.
function changesOf(row: { reason: string | null }, input: UpdateExpense, moving: boolean) {
  const reason = input.reason !== undefined && input.reason !== row.reason
  return {
    ...(reason ? { reason: input.reason } : {}),
    ...(moving ? { eventId: input.eventId } : {}),
  }
}

// 지출의 행사는 결제한 요청의 행사와, 고른 예산 항목의 행사와 어긋나지 않게 옮긴다.
async function assertMoveAllowed(
  tx: Tx,
  actor: Actor,
  row: { id: string; budgetItemId: string | null },
  eventId: string | null,
) {
  assertEventMatchesRequests(await requestEventsOfExpense(tx, actor, row.id), eventId)
  if (row.budgetItemId)
    assertEventMatchesItem(await budgetItemEventsOf(tx, actor, [row.budgetItemId]), eventId)
}

// 정산 전에 재정부가 사유와 행사를 고친다. 학생회 행 잠금과 운영진 확인 뒤에 부르고, 지출 행을 잠근다. 403이 409보다 먼저다.
// 칸을 빼거나 지금과 같은 값이면 바뀐 게 없어 판이 늘지 않는다.
export async function updateExpense(
  tx: Tx,
  actor: Actor,
  expenseId: string,
  input: UpdateExpense,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedExpenseRow(tx, actor, expenseId)
  const moving = input.eventId !== undefined && input.eventId !== row.eventId
  // 옮길 행사가 다른 학생회 것이면 잠금 확인보다 먼저 409 EVENT_INVALID로 거른다.
  if (moving) await assertCouncilEvent(tx, actor, input.eventId)
  // 바꾸기 전 행사(지출과 결제한 요청의 행사)와 옮길 행사 모두 완료 전이어야 한다.
  await assertEventsOpen(tx, [
    ...(await eventsOfExpense(tx, actor, expenseId)),
    moving ? input.eventId : null,
  ])
  if (row.cancelledAt !== null) throw new ApiError('EXPENSE_CANCELLED')
  if (moving) await assertMoveAllowed(tx, actor, row, input.eventId ?? null)
  const changes = changesOf(row, input, moving)
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'expense',
      id: expenseId,
      actor: actor.memberId,
      reason: null,
      changes,
    })
  return expenseDetailOf(tx, actor, expenseId)
}
