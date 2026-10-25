import { HOME_LIST_LIMIT, type HomeParticipating } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { eventDepartmentsByEventOf } from '../access/event-departments.js'
import type { Db } from '../db/types.js'
import { nextDueTaskOf } from '../events/header.js'
import { openEventsAmong, taskCountsByEvent } from '../events/queries.js'
import type { OpenTask } from '../tasks/open-tasks.js'

type Reader = Pick<Db, 'select' | 'selectDistinct'>

// 그 사람의 지금 부서들
export const myDepartmentIds = (actor: Actor) => actor.departments.map(item => item.departmentId)

// 그 사람의 부서가 담당 부서인 행사(완료 여부와 관계없이). 담당 부서는 행사에 이은 취소하지 않은 업무의 부서다(DEC-25, DEC-67).
// 셈은 행사 화면의 담당 부서(eventDepartmentsByEventOf)와 같다. 부서가 없으면 빈 목록이다.
export async function staffedEventIdsOf(db: Reader, actor: Actor): Promise<string[]> {
  const mine = myDepartmentIds(actor)
  if (!mine.length) return []
  const byEvent = await eventDepartmentsByEventOf(db, actor.councilId)
  return [...byEvent]
    .filter(([, departments]) => departments.some(id => mine.includes(id)))
    .map(([eventId]) => eventId)
}

// 참여 행사(DEC-95 '우리 부서 참여 행사'·'참여 행사 진행'): 위 행사 가운데 완료하지 않은 것, 행사 목록과 같은 차례.
// '부서 업무 n/m'은 행사 업무 수와 같은 셈(taskCountsByEvent)을 그 부서들로 좁힌 것이고, 다음 마감은 행사 머리와 같은 셈(nextDueTaskOf)이다.
export async function participatingOf(
  db: Reader,
  actor: Actor,
  now: Date,
  scope: { staffed: string[]; open: OpenTask[] },
): Promise<HomeParticipating> {
  const mine = myDepartmentIds(actor)
  const events = await openEventsAmong(db, actor, now, scope.staffed)
  const shown = events.slice(0, HOME_LIST_LIMIT)
  const counts = await taskCountsByEvent(
    db,
    shown.map(item => item.id),
    mine,
  )
  const rows = shown.map(item => {
    const count = counts.get(item.id) ?? { open: 0, total: 0 }
    const next = nextDueTaskOf(
      scope.open.filter(
        row => row.summary.event?.id === item.id && mine.includes(row.summary.department?.id ?? ''),
      ),
    )
    return {
      event: item,
      tasks: { done: count.total - count.open, total: count.total },
      next: next?.dueDate ? { taskId: next.id, title: next.title, dueDate: next.dueDate } : null,
    }
  })
  return { events: rows, total: events.length }
}
