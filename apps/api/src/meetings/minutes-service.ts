import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  MEETING_AGENDA_LIMIT,
  type AddAgendaRequest,
  type UpdateAgendaRequest,
  type AddDecisionRequest,
  type UpdateDecisionRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { agendaItem, decision, task } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord, updateRecord } from '../records/records.js'
import { meetingDetailOf } from './queries.js'
import { lockedMeeting } from './service.js'
import { assertVersion } from '../records/versions.js'
import { changedFields, lockedAgenda, lockedDecision } from './minutes-locks.js'

type MinutesTarget = { id: string; itemId: string; now: Date }

async function reasonForUpdate(tx: Tx, actor: Actor, target: MinutesTarget, reason?: string) {
  const row = await lockedMeeting(tx, actor, target.id, 'minutes.update')
  if (!row.confirmedAt) return null
  if (!reason?.trim()) throw new ApiError('REASON_REQUIRED')
  return reason
}

export async function addAgenda(
  tx: Tx,
  actor: Actor,
  target: MinutesTarget,
  input: AddAgendaRequest,
) {
  await lockedMeeting(tx, actor, target.id, 'meeting.minutes')
  const [counts] = await tx
    .select({
      count: sql<number>`count(*) filter (where ${agendaItem.cancelledAt} is null)`.mapWith(Number),
      max: sql<number>`coalesce(max(${agendaItem.position}), 0)`.mapWith(Number),
    })
    .from(agendaItem)
    .where(eq(agendaItem.meetingId, target.id))
  if (counts!.count >= MEETING_AGENDA_LIMIT) throw new ApiError('INVALID_INPUT')
  await createRecord(tx, {
    kind: 'agenda_item',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { meetingId: target.id, position: counts!.max + 1, ...input },
  })
  return meetingDetailOf(tx, actor, target.id, target.now)
}

export async function updateAgenda(
  tx: Tx,
  actor: Actor,
  target: MinutesTarget,
  input: UpdateAgendaRequest,
) {
  const reason = await reasonForUpdate(tx, actor, target, input.reason)
  const before = await lockedAgenda(tx, target.id, target.itemId)
  await assertVersion(tx, before.id, input.baseVersionNo)
  const { baseVersionNo: _version, reason: _reason, ...patch } = input
  if (patch.notes !== undefined) patch.notes = patch.notes?.trim() ? patch.notes : null
  const changes = changedFields(before, patch)
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'agenda_item',
      id: before.id,
      actor: actor.memberId,
      reason,
      changes,
    })
  return meetingDetailOf(tx, actor, target.id, target.now)
}

async function assertAgendaUnused(tx: Tx, id: string) {
  const [decided] = await tx
    .select({ id: decision.id })
    .from(decision)
    .where(
      and(
        eq(decision.originId, id),
        eq(decision.originKind, 'agenda_item'),
        isNull(decision.cancelledAt),
      ),
    )
    .limit(1)
  const [tasked] = await tx
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.originId, id), eq(task.originKind, 'agenda_item'), isNull(task.cancelledAt)))
    .limit(1)
  if (decided || tasked) throw new ApiError('AGENDA_IN_USE')
}
export async function cancelAgenda(tx: Tx, actor: Actor, target: MinutesTarget) {
  await lockedMeeting(tx, actor, target.id, 'meeting.minutes')
  await lockedAgenda(tx, target.id, target.itemId)
  await assertAgendaUnused(tx, target.itemId)
  await updateRecord(tx, {
    kind: 'agenda_item',
    id: target.itemId,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: target.now },
  })
  return meetingDetailOf(tx, actor, target.id, target.now)
}

export async function addDecision(
  tx: Tx,
  actor: Actor,
  target: MinutesTarget,
  input: AddDecisionRequest,
) {
  const row = await lockedMeeting(tx, actor, target.id, 'meeting.minutes')
  await lockedAgenda(tx, target.id, target.itemId)
  await createRecord(tx, {
    kind: 'decision',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      ...input,
      originKind: 'agenda_item',
      originId: target.itemId,
      decidedBy: actor.memberId,
      decidedAt: row.meeting.heldAt,
    },
  })
  return meetingDetailOf(tx, actor, target.id, target.now)
}

export async function updateDecision(
  tx: Tx,
  actor: Actor,
  target: MinutesTarget,
  input: UpdateDecisionRequest,
) {
  const reason = await reasonForUpdate(tx, actor, target, input.reason)
  const before = await lockedDecision(tx, target.id, target.itemId)
  await assertVersion(tx, before.id, input.baseVersionNo)
  const { baseVersionNo: _version, reason: _reason, ...patch } = input
  const changes = changedFields(before, patch)
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'decision',
      id: before.id,
      actor: actor.memberId,
      reason,
      changes,
    })
  return meetingDetailOf(tx, actor, target.id, target.now)
}
export async function cancelDecision(tx: Tx, actor: Actor, target: MinutesTarget) {
  await lockedMeeting(tx, actor, target.id, 'meeting.minutes')
  await lockedDecision(tx, target.id, target.itemId)
  await updateRecord(tx, {
    kind: 'decision',
    id: target.itemId,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: target.now },
  })
  return meetingDetailOf(tx, actor, target.id, target.now)
}
