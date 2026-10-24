import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { event, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { decide, factsOf } from './policy.js'

// 업무가 이을 행사. 이 학생회의 행사만 valid다. 다른 학생회 행사의 책임자는 맥락에 넣지 않는다(권한이 없는 사람에게 행사가 있는지 드러내지 않는다).
type EventLink = { valid: boolean; ownerId: string | null }

// 쓰기 거래 안에서 부른다. 행사를 고치는 쓰기와 학생회 행 잠금으로 줄을 서므로, 여기서 읽은 행사는 거래가 끝날 때까지 바뀌지 않는다.
export async function eventLinkOf(
  tx: Tx,
  actor: Actor,
  eventId: string | null,
): Promise<EventLink> {
  if (!eventId) return { valid: true, ownerId: null }
  const [found] = await tx
    .select({ ownerId: event.ownerId })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(and(eq(event.id, eventId), eq(record.councilId, actor.councilId)))
  return found ? { valid: true, ownerId: found.ownerId } : { valid: false, ownerId: null }
}

type Row = {
  departmentId: string | null
  assigneeId: string | null
  createdBy: string | null
  eventId: string | null
}

// 고치기가 정한 행사: 칸을 빼면 그대로, 같은 값이면 확인도 판도 없다. 바꾸면 뒤의 행사 맥락에서도 task.edit가 있어야 한다(앞은 업무를 읽을 때 이미 봤다).
// 403이 409보다 먼저다.
export async function eventChangeOf(
  tx: Tx,
  actor: Actor,
  row: Row,
  wanted: string | null | undefined,
): Promise<{ eventId?: string | null }> {
  if (wanted === undefined || wanted === row.eventId) return {}
  const link = await eventLinkOf(tx, actor, wanted)
  const denied = decide(actor, factsOf({ ...row, eventOwnerId: link.ownerId }), 'task.edit')
  if (denied) throw new ApiError(denied)
  if (!link.valid) throw new ApiError('EVENT_INVALID')
  return { eventId: wanted }
}
