import { and, asc, count, eq, inArray, isNull, lte } from 'drizzle-orm'
import { koreanOf, type HomeTodoRow } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { agendaItem, decision, meeting, record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { factsOf, meetingRowsOf } from '../meetings/queries.js'
import { actionsOf } from '../meetings/policy.js'
import type { OpsPeople } from './ops-contacts.js'

type Reader = Pick<Db, 'select'>
type MinutesRow = Extract<HomeTodoRow, { kind: 'minutes' }>

// 회의마다 빼지 않은 결정 수와 취소하지 않은 후속 업무 수(확정 버튼 옆의 수와 같은 셈, DEC-104). 안건을 거쳐 센다.
async function followCountsOf(db: Reader, meetingIds: string[]) {
  if (!meetingIds.length)
    return { decisions: new Map<string, number>(), tasks: new Map<string, number>() }
  const decisions = await db
    .select({ meetingId: agendaItem.meetingId, n: count() })
    .from(decision)
    .innerJoin(agendaItem, eq(agendaItem.id, decision.originId))
    .where(
      and(
        eq(decision.originKind, 'agenda_item'),
        isNull(decision.cancelledAt),
        inArray(agendaItem.meetingId, meetingIds),
      ),
    )
    .groupBy(agendaItem.meetingId)
  const tasks = await db
    .select({ meetingId: agendaItem.meetingId, n: count() })
    .from(task)
    .innerJoin(agendaItem, eq(agendaItem.id, task.originId))
    .where(
      and(
        eq(task.originKind, 'agenda_item'),
        isNull(task.cancelledAt),
        inArray(agendaItem.meetingId, meetingIds),
      ),
    )
    .groupBy(agendaItem.meetingId)
  const mapOf = (rows: { meetingId: string; n: number }[]) =>
    new Map(rows.map(row => [row.meetingId, row.n]))
  return { decisions: mapOf(decisions), tasks: mapOf(tasks) }
}

// ③ 회의록 줄: 끝났고 확정·취소 전이며 회의록 글이 있는 회의 가운데 내가 만든 것(만든 사람이 지금 운영진이 아니면 회장단 모두).
// 확정할 수 있는지는 회의 화면과 같은 actionsOf로 거른다(DEC-38). 끝난 지 오래된 것부터다.
export async function minutesRowsOf(
  db: Reader,
  actor: Actor,
  people: OpsPeople,
  now: Date,
): Promise<MinutesRow[]> {
  const rows = (
    await meetingRowsOf(
      db,
      actor,
      and(isNull(meeting.cancelledAt), isNull(record.confirmedAt), lte(meeting.endsAt, now)),
    ).orderBy(asc(meeting.endsAt), asc(meeting.id))
  ).filter(
    row =>
      row.hasNotes &&
      (row.createdBy === actor.memberId || !people.tints.has(row.createdBy ?? '')) &&
      actionsOf(actor, factsOf(row)).includes('meeting.confirm'),
  )
  const counts = await followCountsOf(
    db,
    rows.map(row => row.meeting.id),
  )
  return rows.map(row => ({
    kind: 'minutes',
    meeting: {
      id: row.meeting.id,
      title: row.meeting.title,
      endsAt: row.meeting.endsAt ? koreanOf(row.meeting.endsAt) : null,
    },
    decisions: counts.decisions.get(row.meeting.id) ?? 0,
    followUps: counts.tasks.get(row.meeting.id) ?? 0,
  }))
}
