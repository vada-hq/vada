import { and, asc, eq } from 'drizzle-orm'
import type { TaskCreateOptionsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentCouncilMembership } from '../access/current-cohort.js'
import { cohort, councilMembership, department, member } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { eventLinkOf } from './event-link.js'
import { decideCreate } from './policy.js'
import { joinedDisplayNameOf } from '../team/display-name.js'

// 만들기 선택지: 부서(학생회 업무 포함) × (담당자 없음 + 지금 운영진) 가운데 만들기와 같은 판정(decideCreate)이 허용하는 짝만 싣는다.
// 판정을 따로 만들지 않아 선택지와 만들기가 어긋나지 않는다(DEBT-1). 읽기 거래 안에서 부른다.
export async function createOptionsOf(
  tx: Tx,
  actor: Actor,
  eventId: string | undefined,
  now: Date,
): Promise<TaskCreateOptionsResponse> {
  // 다른 학생회 행사와 없는 행사는 404다(빈 선택지로 답하면 행사가 있는지 드러난다).
  const link = await eventLinkOf(tx, actor, eventId ?? null)
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
    .where(eq(department.councilId, actor.councilId))
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
            decideCreate(
              actor,
              { departmentId: row.id, assigneeId: candidate.id },
              link.ownerId,
            ) === null,
        ),
      }))
      .filter(row => row.assignees.length > 0),
  }
}
