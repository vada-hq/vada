import { and, eq, inArray } from 'drizzle-orm'
import {
  dateFromKorean,
  type CreateMeetingRequest,
  type UpdateMeetingRequest,
  type ReplaceMeetingAttendeesRequest,
  type CancelMeetingRequest,
  type MeetingAction,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { meeting, meetingAttendee, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord, updateRecord } from '../records/records.js'
import { factsOf, meetingDetailOf, meetingRowOf, versionOf } from './queries.js'
import { decide } from './policy.js'
import { assertNewEventOpen, assertReferences, attendeeIdsOf } from './references.js'

type Target = { id: string; now: Date }

export async function lockedMeeting(
  tx: Tx,
  actor: Actor,
  id: string,
  action: MeetingAction | 'minutes.update',
) {
  await tx
    .select({ id: meeting.id })
    .from(meeting)
    .innerJoin(record, eq(record.id, meeting.id))
    .where(and(eq(meeting.id, id), eq(record.councilId, actor.councilId)))
    .for('no key update', { of: meeting })
  const row = await meetingRowOf(tx, actor, id)
  const requested =
    action === 'minutes.update' ? (row.confirmedAt ? 'meeting.amend' : 'meeting.minutes') : action
  const denied = decide(actor, factsOf(row), requested)
  if (denied) throw new ApiError(denied)
  return row
}

export async function createMeeting(tx: Tx, actor: Actor, input: CreateMeetingRequest, now: Date) {
  if (!can(actor, 'meeting.create')) throw new ApiError('FORBIDDEN')
  await assertReferences(tx, actor, input)
  await assertNewEventOpen(tx, input.eventId, null)
  const attendees = await attendeeIdsOf(tx, actor, [...input.attendeeIds, actor.memberId], { now })
  const { attendeeIds: _ids, agenda, heldAt, endsAt, ...values } = input
  const id = await createRecord(tx, {
    kind: 'meeting',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { ...values, heldAt: dateFromKorean(heldAt), endsAt: dateFromKorean(endsAt) },
  })
  await tx
    .insert(meetingAttendee)
    .values(attendees.map(memberId => ({ meetingId: id, memberId, addedAt: now })))
  for (const [index, item] of agenda.entries())
    await createRecord(tx, {
      kind: 'agenda_item',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { meetingId: id, position: index + 1, ...item },
    })
  return meetingDetailOf(tx, actor, id, now)
}

type Placement = {
  heldAt: Date
  endsAt: Date | null
  eventId: string | null
  hostDepartmentId: string | null
}
// 고칠 칸만 바꾼 일시·연결. 보내지 않은 칸은 지금 값이다(JSON Merge Patch).
const mergedOf = (
  before: Placement,
  changes: { [K in keyof Placement]?: Placement[K] | undefined },
): Placement => ({
  heldAt: changes.heldAt ?? before.heldAt,
  endsAt: changes.endsAt ?? before.endsAt,
  eventId: changes.eventId === undefined ? before.eventId : changes.eventId,
  hostDepartmentId:
    changes.hostDepartmentId === undefined ? before.hostDepartmentId : changes.hostDepartmentId,
})

export async function updateMeeting(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: UpdateMeetingRequest,
) {
  const row = await lockedMeeting(tx, actor, target.id, 'meeting.edit')
  if ((await versionOf(tx, target.id)) !== input.baseVersionNo)
    throw new ApiError('VERSION_CONFLICT')
  const { baseVersionNo: _version, heldAt, endsAt, ...patch } = input
  const changes = {
    ...patch,
    ...(heldAt !== undefined ? { heldAt: dateFromKorean(heldAt) } : {}),
    ...(endsAt !== undefined ? { endsAt: dateFromKorean(endsAt) } : {}),
  }
  const merged = mergedOf(row.meeting, changes)
  if (merged.endsAt && merged.endsAt <= merged.heldAt) throw new ApiError('INVALID_INPUT')
  await assertReferences(tx, actor, merged)
  await assertNewEventOpen(tx, merged.eventId, row.meeting.eventId)
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'meeting',
      id: target.id,
      actor: actor.memberId,
      reason: null,
      changes,
    })
  return meetingDetailOf(tx, actor, target.id, target.now)
}

export async function replaceMeetingAttendees(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: ReplaceMeetingAttendeesRequest,
) {
  const row = await lockedMeeting(tx, actor, target.id, 'meeting.edit')
  const kept = (
    await tx
      .select({ memberId: meetingAttendee.memberId })
      .from(meetingAttendee)
      .where(eq(meetingAttendee.meetingId, target.id))
  ).map(item => item.memberId)
  // 만든 사람은 늘 참가자다(DEC-104 ⑥). 보낸 명단에 없어도 빼지 않는다.
  const creator = row.createdBy ? [row.createdBy] : []
  const ids = await attendeeIdsOf(tx, actor, [...input.attendeeIds, ...creator], {
    now: target.now,
    kept,
  })
  const removed = kept.filter(id => !ids.includes(id))
  const added = ids.filter(id => !kept.includes(id))
  if (removed.length)
    await tx
      .delete(meetingAttendee)
      .where(
        and(eq(meetingAttendee.meetingId, target.id), inArray(meetingAttendee.memberId, removed)),
      )
  if (added.length)
    await tx
      .insert(meetingAttendee)
      .values(added.map(memberId => ({ meetingId: target.id, memberId, addedAt: target.now })))
  return meetingDetailOf(tx, actor, target.id, target.now)
}

export async function cancelMeeting(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: CancelMeetingRequest,
) {
  await lockedMeeting(tx, actor, target.id, 'meeting.cancel')
  await updateRecord(tx, {
    kind: 'meeting',
    id: target.id,
    actor: actor.memberId,
    reason: input.reason,
    changes: { cancelledAt: target.now, cancelReason: input.reason },
  })
  return meetingDetailOf(tx, actor, target.id, target.now)
}
