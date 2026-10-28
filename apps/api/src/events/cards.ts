import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { EventsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { record, recordVersion, registration, registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { remainingOf } from '../settlement/remaining.js'
import { openTasksOf, type OpenTask } from '../tasks/open-tasks.js'
import { departmentsOf } from './header.js'
import { eventListOf, taskCountsByEvent } from './queries.js'

type Reader = Pick<Db, 'select'>

async function applicantsByEvent(db: Reader, councilId: string, ids: string[]) {
  const rows = await db
    .select({ eventId: registrationForm.eventId, count: count() })
    .from(registration)
    .innerJoin(record, eq(record.id, registration.id))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .where(
      and(
        eq(record.councilId, councilId),
        inArray(registrationForm.eventId, ids),
        isNull(registration.cancelledAt),
      ),
    )
    .groupBy(registrationForm.eventId)
  return new Map(rows.map(row => [row.eventId, row.count]))
}

async function lastVersionsByEvent(db: Reader, ids: string[]) {
  const rows = await db
    .select({
      id: recordVersion.recordId,
      at: sql<number>`extract(epoch from max(lower(${recordVersion.valid}))) * 1000`.mapWith(
        Number,
      ),
    })
    .from(recordVersion)
    .where(inArray(recordVersion.recordId, ids))
    .groupBy(recordVersion.recordId)
  return new Map(rows.map(row => [row.id, new Date(Math.round(row.at)).toISOString()]))
}

function tasksByEvent(tasks: OpenTask[]) {
  const result = new Map<string, OpenTask[]>()
  for (const task of tasks) {
    const id = task.summary.event?.id
    if (!id) continue
    const group = result.get(id) ?? []
    group.push(task)
    result.set(id, group)
  }
  return result
}

// 머리의 담당·업무와 정산 탭의 셈을 재사용한다. 목록의 집계에는 신청자 이름을 읽지 않는다.
export async function eventCardsOf(db: Reader, actor: Actor, now: Date): Promise<EventsResponse> {
  const list = await eventListOf(db, actor, now)
  if (!list.events.length) return { ...list, events: [] }
  const ids = list.events.map(event => event.id)
  const counts = await taskCountsByEvent(db, ids)
  const tasks = tasksByEvent(await openTasksOf(db, actor, now))
  const applicants = await applicantsByEvent(db, actor.councilId, ids)
  const versions = await lastVersionsByEvent(db, ids)
  const events = []
  for (const event of list.events) {
    const remaining = await remainingOf(db, { councilId: actor.councilId, eventId: event.id })
    events.push({
      ...event,
      departments: departmentsOf(tasks.get(event.id) ?? []),
      tasks: counts.get(event.id) ?? { open: 0, total: 0 },
      applicantCount: applicants.get(event.id) ?? 0,
      remaining: remaining.reduce((sum, item) => sum + item.count, 0),
      updatedAt: versions.get(event.id)!,
    })
  }
  return { ...list, events }
}
