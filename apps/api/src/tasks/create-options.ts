import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { EVENT_LIST_LIMIT, type TaskCreateOptionsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentCouncilMembership } from '../access/current-cohort.js'
import { eventDepartmentsByEventOf } from '../access/event-departments.js'
import { cohort, councilMembership, department, event, member, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { eventLinkOf } from './event-link.js'
import { decideCreate, decideEventLink } from './policy.js'
import { joinedDisplayNameOf } from '../team/display-name.js'

// 만들기 선택지: 부서(학생회 업무 포함) × (담당자 없음 + 지금 운영진) 가운데 만들기와 같은 판정(decideCreate)이 허용하는 짝만 싣는다.
// 판정을 따로 만들지 않아 선택지와 만들기가 어긋나지 않는다(DEBT-1). 읽기 거래 안에서 부른다.
export async function createOptionsOf(
  tx: Tx,
  actor: Actor,
  eventId: string | undefined,
  now: Date,
): Promise<TaskCreateOptionsResponse> {
  // 행사마다 담당 부서를 한 번 세어 그 행사의 맥락과 이을 수 있는 행사가 같이 쓴다.
  const staffed = await eventDepartmentsByEventOf(tx, actor.councilId)
  // 다른 학생회 행사와 없는 행사는 404다(빈 선택지로 답하면 행사가 있는지 드러난다).
  const link = await eventLinkOf(tx, actor, eventId ?? null, staffed)
  if (!link.valid) throw new ApiError('NOT_FOUND')
  const members = await tx
    .select({ id: member.id, name: joinedDisplayNameOf(member, actor.councilId) })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .innerJoin(member, eq(member.id, councilMembership.memberId))
    .where(and(eq(cohort.councilId, actor.councilId), currentCouncilMembership(now)))
    .orderBy(asc(councilMembership.startsAt), asc(member.id))
  const departments = await tx
    .select({ id: department.id, name: department.name })
    .from(department)
    // 그만 쓴 부서는 고르는 칸에서 빠진다(DEC-91).
    .where(and(eq(department.councilId, actor.councilId), isNull(department.retiredAt)))
    .orderBy(asc(department.id))
  const candidates: { id: string | null; name: string | null }[] = [
    { id: null, name: null },
    ...members,
  ]
  // 학생회 업무(부서 없음)는 맨 뒤다.
  const rows: { id: string | null; name: string | null }[] = [
    ...departments,
    { id: null, name: null },
  ]
  return {
    departments: rows
      .map(row => ({
        ...row,
        assignees: candidates.filter(
          candidate =>
            decideCreate(actor, { departmentId: row.id, assigneeId: candidate.id }, link) === null,
        ),
      }))
      .filter(row => row.assignees.length > 0),
    linkableEvents: await linkableEventsOf(tx, actor, rows, staffed),
  }
}

// 부서마다 이을 수 있는 행사: 만들기·행사 바꾸기와 같은 판정(decideEventLink)이 허용하는 행사만 싣는다(DEBT-1).
// 행사 목록 화면과 같은 상한까지 최근에 만든 것부터 읽는다. 넘친 옛 행사는 싣지 않아 고르지 못할 뿐 열리지 않는다(기본 거부).
async function linkableEventsOf(
  tx: Tx,
  actor: Actor,
  rows: { id: string | null }[],
  staffed: ReadonlyMap<string, readonly string[]>,
) {
  const events = await tx
    .select({ id: event.id, ownerId: event.ownerId })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(eq(record.councilId, actor.councilId))
    .orderBy(desc(record.createdAt), desc(event.id))
    .limit(EVENT_LIST_LIMIT)
  const linkable = (departmentId: string | null, item: (typeof events)[number]) =>
    decideEventLink(actor, departmentId, {
      ownerId: item.ownerId,
      departmentIds: staffed.get(item.id) ?? [],
    }) === null
  return rows.map(row => ({
    departmentId: row.id,
    eventIds: events.filter(item => linkable(row.id, item)).map(item => item.id),
  }))
}
