import { and, eq } from 'drizzle-orm'
import {
  dateFromKorean,
  type CreateScheduleItemRequest,
  type UpdateScheduleItemRequest,
  type ScheduleAction,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, isLeadership } from '../access/permissions.js'
import { scheduleItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { assertScheduleReferences } from '../records/same-council.js'
import { decide } from './policy.js'
import { scheduleDetailOf, scheduleRowOf } from './queries.js'

function assertDepartment(actor: Actor, departmentId: string | null) {
  if (
    departmentId &&
    !isLeadership(actor) &&
    !actor.departments.some(item => item.departmentId === departmentId)
  )
    throw new ApiError('FORBIDDEN')
}

function valuesOf({ when, ...input }: CreateScheduleItemRequest) {
  return {
    ...input,
    startsOn: when.allDay ? when.startsOn : null,
    endsOn: when.allDay ? when.endsOn : null,
    startsAt: when.allDay ? null : dateFromKorean(when.startsAt),
    endsAt: !when.allDay && when.endsAt ? dateFromKorean(when.endsAt) : null,
  }
}

async function lockedItem(tx: Tx, actor: Actor, id: string, action: ScheduleAction) {
  await tx
    .select({ id: scheduleItem.id })
    .from(scheduleItem)
    .where(and(eq(scheduleItem.id, id), eq(scheduleItem.councilId, actor.councilId)))
    .for('update')
  const row = await scheduleRowOf(tx, actor, id)
  const refused = decide(actor, { ...row.item, createdBy: row.createdBy }, action)
  if (refused) throw new ApiError(refused)
  return row
}

export async function createScheduleItem(
  tx: Tx,
  actor: Actor,
  input: CreateScheduleItemRequest,
  now: Date,
) {
  if (!can(actor, 'schedule.create')) throw new ApiError('FORBIDDEN')
  await assertScheduleReferences(tx, actor.councilId, input)
  assertDepartment(actor, input.departmentId)
  const id = await createRecord(tx, {
    kind: 'schedule_item',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: valuesOf(input),
  })
  return scheduleDetailOf(tx, actor, id, now)
}

export async function updateScheduleItem(
  tx: Tx,
  actor: Actor,
  target: { id: string; now: Date },
  input: UpdateScheduleItemRequest,
) {
  const row = await lockedItem(tx, actor, target.id, 'schedule.update')
  await assertScheduleReferences(tx, actor.councilId, input)
  if (input.departmentId !== row.item.departmentId) assertDepartment(actor, input.departmentId)
  await updateRecord(tx, {
    kind: 'schedule_item',
    id: target.id,
    actor: actor.memberId,
    reason: null,
    changes: valuesOf(input),
  })
  return scheduleDetailOf(tx, actor, target.id, target.now)
}

export async function deleteScheduleItem(tx: Tx, actor: Actor, id: string) {
  await lockedItem(tx, actor, id, 'schedule.delete')
  await updateRecord(tx, {
    kind: 'schedule_item',
    id,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}
