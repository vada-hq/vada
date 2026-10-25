import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 행사를 맡게 하는 업무: 이 학생회의 취소하지 않은 업무 가운데 부서가 있는 것. 행사 하나와 학생회 전체의 셈이 같은 조건을 쓴다.
const staffingTasks = (councilId: string) =>
  and(eq(record.councilId, councilId), isNull(task.cancelledAt), isNotNull(task.departmentId))

// 행사 담당 부서(DEC-25): 그 행사의 취소하지 않은 업무가 가리키는 부서들. 참가 신청 칸의 맥락(eventDepartmentIds)이다.
// 권한이 업무에서 세어지므로 업무를 취소하거나 부서를 바꾸면 바로 달라진다. 학생회로 거른다: 다른 학생회의 행사는 빈 목록이다.
export async function eventDepartmentIdsOf(
  db: Pick<Db, 'select'>,
  councilId: string,
  eventId: string,
): Promise<string[]> {
  const rows = await db
    .select({ departmentId: task.departmentId })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .where(and(eq(task.eventId, eventId), staffingTasks(councilId)))
  return [...new Set(rows.flatMap(row => (row.departmentId ? [row.departmentId] : [])))]
}

// 학생회의 행사마다 담당 부서(위와 같은 셈을 한 번에). 업무 만들기 선택지의 이을 수 있는 행사가 쓴다.
export async function eventDepartmentsByEventOf(
  db: Pick<Db, 'selectDistinct'>,
  councilId: string,
): Promise<Map<string, string[]>> {
  const rows = await db
    .selectDistinct({ eventId: task.eventId, departmentId: task.departmentId })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .where(and(isNotNull(task.eventId), staffingTasks(councilId)))
  const byEvent = new Map<string, string[]>()
  for (const { eventId, departmentId } of rows)
    if (eventId && departmentId)
      byEvent.set(eventId, [...(byEvent.get(eventId) ?? []), departmentId])
  return byEvent
}
