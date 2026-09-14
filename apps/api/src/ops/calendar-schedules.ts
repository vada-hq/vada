import { and, eq, isNotNull, ne, notInArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, meetings, tasks } from '../db/schema.ts'
import { RANK, type Schedule, type ScheduleType } from './calendar-domain.ts'

/**
 * 이 학생회의 일정 전부.
 *
 * **세 표에서 모은다.** 행사는 일시가 잡힌 것, 회의는 일시가 잡히고 알려진 것,
 * 마감은 **완료되지 않은 업무의 기한**이다(그림이 격자 곁에 그 규칙을 적었다).
 *
 * 회의에서 초안과 취소를 빼는 것은 이 저장소가 이미 든 규칙이다 — 임시 저장한
 * 회의는 아직 아무에게도 알리지 않은 것이고 취소한 회의는 예정이 아니다
 * (`space.ts`의 '오늘 회의'와 `meeting.groups`가 같은 길이다).
 *
 * 행사와 회의에는 단계로 거르는 규칙이 그림에 없다. **마감에만 그 규칙이 적혀
 * 있다는 것이 곧 나머지에는 없다는 뜻**이므로 지어내지 않는다 — 지난 행사도 그날에
 * 있었고, 격자는 '언제 무엇이 있었나'를 그린다.
 */
export async function orgSchedules(
  db: Db,
  orgId: string,
  type: ScheduleType | null,
): Promise<Schedule[]> {
  const wants = (one: ScheduleType) => type === null || type === one

  const found: Schedule[] = []

  if (wants('event')) {
    const rows = await db
      .select({ id: events.id, title: events.title, startAt: events.startAt })
      .from(events)
      .where(and(eq(events.orgId, orgId), isNotNull(events.startAt)))
    for (const row of rows) {
      found.push({
        id: `event:${row.id}`,
        type: 'event',
        at: row.startAt!,
        title: row.title,
        // 행사 줄의 원본이 그 행사 자신이다.
        eventId: row.id,
      })
    }
  }

  if (wants('meeting')) {
    const rows = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        eventId: meetings.eventId,
      })
      .from(meetings)
      .where(
        and(
          eq(meetings.orgId, orgId),
          isNotNull(meetings.scheduledAt),
          notInArray(meetings.status, ['draft', 'cancelled']),
        ),
      )
    for (const row of rows) {
      found.push({
        id: `meeting:${row.id}`,
        type: 'meeting',
        at: row.scheduledAt!,
        title: row.title,
        eventId: row.eventId,
      })
    }
  }

  if (wants('deadline')) {
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        eventId: tasks.eventId,
      })
      .from(tasks)
      .where(
        and(eq(tasks.orgId, orgId), isNotNull(tasks.dueDate), ne(tasks.status, 'done')),
      )
    for (const row of rows) {
      found.push({
        id: `deadline:${row.id}`,
        type: 'deadline',
        at: row.dueDate!,
        title: row.title,
        eventId: row.eventId,
      })
    }
  }

  // **차례를 명세도 그림도 말하지 않는다.** 안 정하면 저장소가 주는 대로 그려져
  // 새로고침마다 줄이 자리를 바꾼다 — 업무 보드가 같은 자리에서 같은 것을 정했다.
  return found.sort((left, right) => order(left).localeCompare(order(right)))
}

function order(one: Schedule): string {
  return `${one.at.toISOString()}${RANK.get(one.type) ?? 9}${one.title}${one.id}`
}
