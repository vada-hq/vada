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
import {
  assertEventMatchesItem,
  assertEventMatchesRequests,
  eventFilledFromItem,
} from './event-rule.js'
import { lockedExpenseRow } from './lock.js'
import { expenseDetailOf } from './queries.js'

// 바뀌는 칸만 모은다: 칸을 빼거나 지금과 같은 값이면 넣지 않는다.
function changesOf(
  row: { reason: string | null },
  input: UpdateExpense,
  target: { moving: boolean; eventId: string | null },
) {
  const reason = input.reason !== undefined && input.reason !== row.reason
  return {
    ...(reason ? { reason: input.reason } : {}),
    ...(target.moving ? { eventId: target.eventId } : {}),
  }
}

// 지출의 행사는 결제한 요청의 행사와, 고른 예산 항목의 행사와 어긋나지 않게 옮긴다.
async function assertMoveAllowed(
  tx: Tx,
  actor: Actor,
  move: { expenseId: string; itemEvents: readonly string[]; eventId: string | null },
) {
  assertEventMatchesRequests(await requestEventsOfExpense(tx, actor, move.expenseId), move.eventId)
  assertEventMatchesItem(move.itemEvents, move.eventId)
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
  const asked = input.eventId !== undefined && input.eventId !== row.eventId
  // 옮길 행사가 다른 학생회 것이면 잠금 확인보다 먼저 409 EVENT_INVALID로 거른다.
  if (asked) await assertCouncilEvent(tx, actor, input.eventId)
  // 행사를 비우려 해도 고른 예산 항목에 행사가 있으면 그 행사로 채운다.
  const itemEvents = row.budgetItemId ? await budgetItemEventsOf(tx, actor, [row.budgetItemId]) : []
  const eventId = eventFilledFromItem(
    itemEvents,
    input.eventId === undefined ? row.eventId : input.eventId,
  )
  const moving = eventId !== row.eventId
  // 바꾸기 전 행사(지출과 결제한 요청의 행사)와 옮길 행사 모두 완료 전이어야 한다.
  await assertEventsOpen(tx, [
    ...(await eventsOfExpense(tx, actor, expenseId)),
    moving ? eventId : null,
  ])
  if (row.cancelledAt !== null) throw new ApiError('EXPENSE_CANCELLED')
  if (moving) await assertMoveAllowed(tx, actor, { expenseId, itemEvents, eventId })
  const changes = changesOf(row, input, { moving, eventId })
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
