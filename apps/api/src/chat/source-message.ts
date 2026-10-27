import { and, eq, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { evidenceLink, expense, lineItem, message, record, request } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { itemCountColumns } from '../purchases/last-outcome.js'
import { requestStatusOf } from '../purchases/policy.js'
import { linkEvidence } from '../records/evidence-link.js'
import { canSeeMessage } from './photos.js'

// 반려·취소된 요청은 그 메시지로 새 요청을 막지 않는다(DEC-73 반려 뒤 새 요청).
const CLOSED_STATUSES: readonly string[] = ['rejected', 'cancelled']

// 요청이 그 메시지로 새 요청을 막는가(반려·취소가 아님). 상태는 요청 목록·상세와 같은 셈(requestStatusOf)이다.
// 메시지 아래 기록(made.ts)도 같은 판단으로 메뉴의 '구매 요청 보기'를 가른다.
export const requestBlocks = (
  cancelledAt: Date | null,
  counts: Parameters<typeof requestStatusOf>[1],
) => !CLOSED_STATUSES.includes(requestStatusOf(cancelledAt !== null, counts))

// 이 메시지로 만든 요청 가운데 반려·취소가 아닌 것이 있는가.
async function liveRequestFrom(tx: Tx, actor: Actor, messageId: string) {
  const rows = await tx
    .select({ cancelledAt: request.cancelledAt, ...itemCountColumns() })
    .from(evidenceLink)
    .innerJoin(request, eq(request.id, evidenceLink.recordId))
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .where(
      and(
        eq(evidenceLink.messageId, messageId),
        eq(record.councilId, actor.councilId),
        eq(request.type, 'purchase'),
      ),
    )
    .groupBy(request.id)
  return rows.some(row => requestBlocks(row.cancelledAt, row))
}

// 이 메시지로 만든 지출 가운데 취소되지 않은 것이 있는가.
async function liveExpenseFrom(tx: Tx, actor: Actor, messageId: string) {
  const [found] = await tx
    .select({ id: expense.id })
    .from(evidenceLink)
    .innerJoin(expense, eq(expense.id, evidenceLink.recordId))
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        eq(evidenceLink.messageId, messageId),
        eq(record.councilId, actor.councilId),
        isNull(expense.cancelledAt),
      ),
    )
    .limit(1)
  return found !== undefined
}

// 같은 메시지로 같은 종류의 살아 있는 기록이 있으면 409다(022 정한 것 23). 요청과 지출은 서로 막지 않는다.
// 라우트는 학생회 행을 먼저 잠가 이미 줄을 세우고, 메시지 행 잠금은 학생회 행을 잠그지 않는 길을 위한 방어다.
// 메시지 행을 잠근 뒤에 읽으므로 같은 메시지로 둘이 동시에 와도 뒤의 것은 앞의 것이 끝난 뒤의 연결을 본다(READ COMMITTED).
// FOR NO KEY UPDATE라서 이 메시지를 가리키는 연결을 넣을 때의 외래 키 검사는 막지 않는다.
async function assertSourceUnused(tx: Tx, actor: Actor, recordId: string, messageId: string) {
  await tx
    .select({ id: message.id })
    .from(message)
    .where(eq(message.id, messageId))
    .for('no key update')
  // 잠금을 기다리는 동안 방 참여나 가시성이 바뀌었어도 중복 여부보다 먼저 감춘다.
  if (!(await canSeeMessage(tx, actor, messageId))) throw new ApiError('MESSAGE_INVALID')
  const [made] = await tx.select({ kind: record.kind }).from(record).where(eq(record.id, recordId))
  const live =
    made?.kind === 'request'
      ? await liveRequestFrom(tx, actor, messageId)
      : made?.kind === 'expense' && (await liveExpenseFrom(tx, actor, messageId))
  if (live) throw new ApiError('SOURCE_MESSAGE_USED')
}

// 요청·지출을 만든 거래에서 그 메시지를 근거로 잇는다(DEC-45). 내가 지금 볼 수 있는 메시지만 되고,
// 아니면 있는지도 드러내지 않는 같은 409다. 거래가 실패하면 만든 기록도 함께 없어진다.
export async function linkSourceMessage(
  tx: Tx,
  actor: Actor,
  recordId: string,
  messageId: string | null,
) {
  if (messageId === null) return
  if (!(await canSeeMessage(tx, actor, messageId))) throw new ApiError('MESSAGE_INVALID')
  await assertSourceUnused(tx, actor, recordId, messageId)
  await linkEvidence(tx, actor.councilId, recordId, messageId)
}
