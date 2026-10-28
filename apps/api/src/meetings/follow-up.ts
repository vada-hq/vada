import { and, asc, eq, isNull } from 'drizzle-orm'
import type { MeetingAgendaItem, TaskDetail, TaskStatus } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { agendaItem, meeting, record, task } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { dueDateOf } from '../tasks/due.js'
import { memberNamesOf } from '../team/display-name.js'
import { lockedAgenda } from './minutes-locks.js'
import { lockedMeeting } from './service.js'

// 취소·안건 빼기와 같은 회의 → 안건 순서로 잠가 확인과 업무 쓰기를 묶는다.
export async function assertFollowUpOrigin(tx: Tx, actor: Actor, agendaItemId: string) {
  const [found] = await tx
    .select({ meetingId: agendaItem.meetingId })
    .from(agendaItem)
    .innerJoin(record, eq(record.id, agendaItem.id))
    .where(and(eq(agendaItem.id, agendaItemId), eq(record.councilId, actor.councilId)))
  if (!found) throw new ApiError('NOT_FOUND')
  await lockedMeeting(tx, actor, found.meetingId, 'meeting.minutes')
  await lockedAgenda(tx, found.meetingId, agendaItemId)
  return agendaItemId
}

// 업무 상세만 읽는다. 지운 업무도 출처 자체는 보존된다.
export async function taskOriginOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  taskId: string,
): Promise<TaskDetail['origin']> {
  const [origin] = await db
    .select({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      agendaId: agendaItem.id,
      agendaTitle: agendaItem.title,
    })
    .from(task)
    .innerJoin(
      agendaItem,
      and(eq(agendaItem.id, task.originId), eq(task.originKind, 'agenda_item')),
    )
    .innerJoin(meeting, eq(meeting.id, agendaItem.meetingId))
    .innerJoin(record, eq(record.id, agendaItem.id))
    .where(and(eq(task.id, taskId), eq(record.councilId, actor.councilId)))
  return origin ?? null
}

// 안건 수와 무관하게 업무와 담당자 이름을 각각 한 번에 읽는다. 읽기 권한은 업무 목록과 같다.
export async function followUpsOf(tx: Tx, actor: Actor, meetingId: string) {
  const rows = await tx
    .select({
      id: task.id,
      title: task.title,
      status: task.status,
      dueAt: task.dueAt,
      agendaId: agendaItem.id,
      assigneeId: task.assigneeId,
    })
    .from(task)
    .innerJoin(
      agendaItem,
      and(eq(agendaItem.id, task.originId), eq(task.originKind, 'agenda_item')),
    )
    .innerJoin(record, eq(record.id, task.id))
    .where(
      and(
        eq(agendaItem.meetingId, meetingId),
        eq(record.councilId, actor.councilId),
        isNull(task.cancelledAt),
      ),
    )
    .orderBy(asc(record.createdAt), asc(task.id))
  const ids = [...new Set(rows.flatMap(row => (row.assigneeId ? [row.assigneeId] : [])))]
  const names = await memberNamesOf(tx, actor.councilId, ids)
  const byAgenda = new Map<string, MeetingAgendaItem['followUps']>()
  for (const { agendaId, assigneeId, status, dueAt, ...row } of rows) {
    const list = byAgenda.get(agendaId) ?? []
    list.push({
      ...row,
      status: status as TaskStatus,
      dueDate: dueDateOf(dueAt),
      assignee: assigneeId ? { id: assigneeId, name: names.get(assigneeId)! } : null,
    })
    byAgenda.set(agendaId, list)
  }
  return byAgenda
}
