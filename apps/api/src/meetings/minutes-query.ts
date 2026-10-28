import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { MeetingAgendaItem, MeetingPerson } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { agendaItem, decision, record, recordVersion } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { memberNamesOf } from '../team/display-name.js'
import { followUpsOf } from './follow-up.js'

const openVersion = and(
  eq(recordVersion.recordId, record.id),
  sql`upper_inf(${recordVersion.valid})`,
)

// 안건 수와 무관하게 안건·결정을 각각 한 번 읽고, 표시 이름도 한꺼번에 맞춘다.
export async function minutesAgendaOf(
  tx: Tx,
  actor: Actor,
  id: string,
  now: Date,
): Promise<MeetingAgendaItem[]> {
  const agendas = await tx
    .select({
      id: agendaItem.id,
      position: agendaItem.position,
      title: agendaItem.title,
      body: agendaItem.body,
      notes: agendaItem.notes,
      versionNo: recordVersion.versionNo,
      changedBy: recordVersion.changedBy,
      updatedAt: sql<string>`lower(${recordVersion.valid})`.mapWith((value: string) =>
        new Date(value).toISOString(),
      ),
    })
    .from(agendaItem)
    .innerJoin(record, eq(record.id, agendaItem.id))
    .innerJoin(recordVersion, openVersion)
    .where(and(eq(agendaItem.meetingId, id), isNull(agendaItem.cancelledAt)))
    .orderBy(asc(agendaItem.position), asc(agendaItem.id))
  const decisions = await decisionsOf(tx, id)
  const followUps = await followUpsOf(tx, actor, id)
  const ids = [
    ...new Set(
      [...agendas.map(a => a.changedBy), ...decisions.map(d => d.decidedBy)].filter(
        (v): v is string => v !== null,
      ),
    ),
  ]
  const names = await memberNamesOf(tx, actor.councilId, ids)
  const current = await currentMembersAmong(tx, actor.councilId, ids, now)
  const person = (memberId: string | null): MeetingPerson | null =>
    memberId ? { id: memberId, name: names.get(memberId)!, current: current.has(memberId) } : null
  const byAgenda = new Map<string, MeetingAgendaItem['decisions']>()
  for (const { originId, ...d } of decisions) {
    const list = byAgenda.get(originId!) ?? []
    list.push({ ...d, decidedBy: person(d.decidedBy), decidedAt: d.decidedAt.toISOString() })
    byAgenda.set(originId!, list)
  }
  return agendas.map(({ changedBy, ...a }) => ({
    ...a,
    updatedBy: person(changedBy),
    decisions: byAgenda.get(a.id) ?? [],
    followUps: followUps.get(a.id) ?? [],
  }))
}
function decisionsOf(tx: Tx, id: string) {
  return tx
    .select({
      id: decision.id,
      originId: decision.originId,
      content: decision.content,
      rationale: decision.rationale,
      decidedBy: decision.decidedBy,
      decidedAt: decision.decidedAt,
      versionNo: recordVersion.versionNo,
    })
    .from(decision)
    .innerJoin(agendaItem, eq(agendaItem.id, decision.originId))
    .innerJoin(record, eq(record.id, decision.id))
    .innerJoin(recordVersion, openVersion)
    .where(
      and(
        eq(agendaItem.meetingId, id),
        eq(decision.originKind, 'agenda_item'),
        isNull(agendaItem.cancelledAt),
        isNull(decision.cancelledAt),
      ),
    )
    .orderBy(asc(record.createdAt), asc(decision.id))
}
