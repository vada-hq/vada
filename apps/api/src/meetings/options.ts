import { and, asc, eq, isNull } from 'drizzle-orm'
import type { MeetingOptionsQuery, MeetingOptionsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { eventDepartmentIdsOf } from '../access/event-departments.js'
import {
  councilMembership,
  department,
  departmentMembership,
  event,
  member,
  record,
} from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { joinedDisplayNameOf } from '../team/display-name.js'
import { assertReferences } from './references.js'

async function membersOf(tx: Tx, actor: Actor) {
  return tx
    .select({ id: member.id, name: joinedDisplayNameOf(member, actor.councilId) })
    .from(councilMembership)
    .innerJoin(member, eq(member.id, councilMembership.memberId))
    .where(
      and(
        eq(councilMembership.cohortId, actor.cohortId),
        isNull(councilMembership.endsAt),
        isNull(member.leftAt),
      ),
    )
    .orderBy(asc(member.id))
}

async function defaultsOf(tx: Tx, actor: Actor, query: MeetingOptionsQuery, ids: string[]) {
  if (!query.hostDepartment && !query.event) return ids
  const departments = query.hostDepartment
    ? [query.hostDepartment]
    : await eventDepartmentIdsOf(tx, actor.councilId, query.event!)
  const placements = await tx
    .select({
      memberId: departmentMembership.memberId,
      departmentId: departmentMembership.departmentId,
    })
    .from(departmentMembership)
    .where(
      and(eq(departmentMembership.cohortId, actor.cohortId), isNull(departmentMembership.endsAt)),
    )
  const wanted = new Set(
    placements.filter(row => departments.includes(row.departmentId)).map(row => row.memberId),
  )
  if (query.event && !query.hostDepartment) {
    const [row] = await tx
      .select({ ownerId: event.ownerId })
      .from(event)
      .where(eq(event.id, query.event))
    if (row?.ownerId) wanted.add(row.ownerId)
  }
  return ids.filter(id => wanted.has(id))
}

export async function meetingOptionsOf(
  tx: Tx,
  actor: Actor,
  query: MeetingOptionsQuery,
): Promise<MeetingOptionsResponse> {
  await assertReferences(tx, actor, {
    eventId: query.event ?? null,
    hostDepartmentId: query.hostDepartment ?? null,
  })
  const departments = await tx
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(eq(department.councilId, actor.councilId))
    .orderBy(asc(department.id))
  const events = await tx
    .select({ id: event.id, name: event.name })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(eq(record.councilId, actor.councilId))
    .orderBy(asc(event.id))
  const completed = await completedEventIdsAmong(
    tx,
    events.map(row => row.id),
  )
  const members = (await membersOf(tx, actor)).map(row => ({ ...row, current: true }))
  return {
    departments,
    events: events.filter(row => !completed.has(row.id)),
    members,
    defaultAttendeeIds: await defaultsOf(
      tx,
      actor,
      query,
      members.map(row => row.id),
    ),
  }
}
