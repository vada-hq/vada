import { and, eq, type SQL } from 'drizzle-orm'
import {
  koreanOf,
  type ScheduleItemDetail,
  type ScheduleType,
  type ScheduleVisibility,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { department, event, member, record, scheduleItem } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { displayNameOf } from '../team/display-name.js'
import { actionsOf } from './policy.js'
import { visibleScheduleWhere } from './visibility.js'

type Reader = Pick<Db, 'select'>

export function scheduleRowsOf(db: Reader, actor: Actor, where?: SQL) {
  return db
    .select({
      item: scheduleItem,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      creatorName: displayNameOf(member, record.councilId),
      department: { id: department.id, name: department.name },
      event: { id: event.id, name: event.name },
    })
    .from(scheduleItem)
    .innerJoin(record, eq(record.id, scheduleItem.id))
    .leftJoin(member, eq(member.id, record.createdBy))
    .leftJoin(department, eq(department.id, scheduleItem.departmentId))
    .leftJoin(event, eq(event.id, scheduleItem.eventId))
    .where(and(visibleScheduleWhere(actor), where))
}

export function scheduleWhenOf(item: typeof scheduleItem.$inferSelect) {
  // DB의 배타 CHECK가 시작 날짜·시각 가운데 하나를 보장한다.
  return item.startsOn !== null
    ? { allDay: true, start: item.startsOn, end: item.endsOn }
    : {
        allDay: false,
        start: koreanOf(item.startsAt!),
        end: item.endsAt ? koreanOf(item.endsAt) : null,
      }
}

export async function scheduleRowOf(db: Reader, actor: Actor, id: string) {
  const [row] = await scheduleRowsOf(db, actor, eq(scheduleItem.id, id))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

export async function scheduleDetailOf(
  db: Reader,
  actor: Actor,
  id: string,
  now: Date,
): Promise<ScheduleItemDetail> {
  const row = await scheduleRowOf(db, actor, id)
  const current = await currentMembersAmong(
    db,
    actor.councilId,
    row.createdBy ? [row.createdBy] : [],
    now,
  )
  return {
    id: row.item.id,
    title: row.item.title,
    type: row.item.type as ScheduleType,
    ...scheduleWhenOf(row.item),
    place: row.item.place,
    memo: row.item.memo,
    visibility: row.item.visibility as ScheduleVisibility,
    department: row.department,
    event: row.event,
    createdBy: row.createdBy
      ? { id: row.createdBy, name: row.creatorName, current: current.has(row.createdBy) }
      : null,
    createdAt: row.createdAt.toISOString(),
    actions: actionsOf(actor, { ...row.item, createdBy: row.createdBy }),
  }
}
