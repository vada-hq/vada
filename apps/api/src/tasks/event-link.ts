import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { event, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { eventDepartmentIdsOf } from '../access/event-departments.js'
import { decide, decideEventLink, factsOf, type EventScope } from './policy.js'

// 업무가 이을 행사. 이 학생회의 행사만 valid다. 다른 학생회 행사의 책임자와 담당 부서는 맥락에 넣지 않는다(권한이 없는 사람에게 행사가 있는지 드러내지 않는다).
type EventLink = EventScope & { valid: boolean }
const NO_EVENT: EventLink = { valid: true, ownerId: null, departmentIds: null }

// 쓰기 거래 안에서 부른다. 행사를 고치는 쓰기와 학생회 행 잠금으로 줄을 서므로, 여기서 읽은 행사는 거래가 끝날 때까지 바뀌지 않는다.
// 학생회의 행사마다 담당 부서를 이미 센 읽기(만들기 선택지)는 그 셈(staffed)을 넘겨 업무 표를 다시 읽지 않는다.
export async function eventLinkOf(
  tx: Tx,
  actor: Actor,
  eventId: string | null,
  staffed?: ReadonlyMap<string, readonly string[]>,
): Promise<EventLink> {
  if (!eventId) return NO_EVENT
  const [found] = await tx
    .select({ ownerId: event.ownerId })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(and(eq(event.id, eventId), eq(record.councilId, actor.councilId)))
  if (!found) return { ...NO_EVENT, valid: false }
  const departmentIds = staffed
    ? (staffed.get(eventId) ?? [])
    : await eventDepartmentIdsOf(tx, actor.councilId, eventId)
  return { valid: true, ownerId: found.ownerId, departmentIds }
}

// 부서 정하기: 행사에 이어진 업무를 그 행사의 담당 부서가 아닌 부서로 옮기면 그 부서를 행사에 새로 잇는 것이다(DEC-94).
// 지금은 부서 정하기 칸이 새 부서 잇기 칸 안에 들지만(permissions.test.ts), 칸이 넓어져도 이 쓰기가 잇기와 같은 판정을 거치게 여기서도 묻는다.
// 이 업무는 앞의 부서로 그 행사에 세어져 있지만 뒤의 부서와 달라 판정을 바꾸지 않는다. 비우기는 보는 사람이 좁아질 뿐이라 묻지 않는다.
export async function assertDepartmentLink(
  tx: Tx,
  actor: Actor,
  row: { eventId: string | null; departmentId: string | null },
  wanted: string | null,
) {
  if (!row.eventId || wanted === row.departmentId) return
  const denied = decideEventLink(actor, wanted, await eventLinkOf(tx, actor, row.eventId))
  if (denied) throw new ApiError(denied)
}

type Row = {
  departmentId: string | null
  assigneeId: string | null
  createdBy: string | null
  eventId: string | null
}

// 고치기가 정한 행사: 칸을 빼면 그대로, 같은 값이면 확인도 판도 없다. 바꾸면 뒤의 행사 맥락에서도 task.edit가 있어야 한다(앞은 업무를 읽을 때 이미 봤다).
// 뒤의 행사에 이 업무의 부서가 담당 부서가 아니면 새 부서를 잇는 것이다(decideEventLink). 이 업무는 아직 앞의 행사에 있어 뒤의 담당 부서에 세지 않는다.
// 403이 409보다 먼저다.
export async function eventChangeOf(
  tx: Tx,
  actor: Actor,
  row: Row,
  wanted: string | null | undefined,
): Promise<{ eventId?: string | null }> {
  if (wanted === undefined || wanted === row.eventId) return {}
  const link = await eventLinkOf(tx, actor, wanted)
  const denied =
    decide(actor, factsOf({ ...row, eventOwnerId: link.ownerId }), 'task.edit') ??
    decideEventLink(actor, row.departmentId, link)
  if (denied) throw new ApiError(denied)
  if (!link.valid) throw new ApiError('EVENT_INVALID')
  return { eventId: wanted }
}
