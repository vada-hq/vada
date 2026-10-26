import { DAY_MS, koreanDateOf, koreanOf, type EventDetail, type EventStatus } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { openTasksOf, type OpenTask } from '../tasks/open-tasks.js'
import { eventEndDayOf } from './end-day.js'

type Reader = Pick<Db, 'select'>
type Header = Pick<EventDetail, 'departments' | 'health' | 'next' | 'endedDays'>

// 업무 마감은 그날이 끝날 때라, 행사 시작(한국 시각)과 견줄 때 그날의 마지막 분으로 둔다.
const DUE_END_OF_DAY = 'T23:59'

const departmentsOf = (tasks: OpenTask[]) =>
  [...new Set(tasks.flatMap(item => item.summary.department?.name ?? []))].sort((a, b) =>
    a.localeCompare(b, 'ko'),
  )

// 다음 마감 업무. 업무는 마감 순으로 읽어 왔으므로 지나지 않은 첫 업무가 가장 이르다. 홈 참여 행사의 다음 마감이 같이 쓴다.
export const nextDueTaskOf = (tasks: OpenTask[]) =>
  tasks.find(item => item.summary.dueDate !== null && !item.summary.overdue)?.summary

// 지금 뒤의 가장 이른 것. 같은 날이면 행사 시작이 업무 마감(그날 끝)보다 이르다. 홈 회장단 행사 카드의 다음 마감이 같이 쓴다.
export function nextScheduleOf(
  tasks: OpenTask[],
  startsAt: Date | null,
  now: Date,
): EventDetail['next'] {
  const task = nextDueTaskOf(tasks)
  const start = startsAt && startsAt.getTime() > now.getTime() ? koreanOf(startsAt) : null
  if (start && (!task?.dueDate || start < `${task.dueDate}${DUE_END_OF_DAY}`))
    return { kind: 'start', startsAt: start }
  return task?.dueDate ? { kind: 'task', dueDate: task.dueDate, title: task.title } : null
}

// 끝난 행사의 끝 날짜(한국)부터 오늘(한국)까지 센 날수. 두 날짜 모두 UTC 자정으로 읽어 하루가 정확히 DAY_MS다.
// 홈 '후속 정리 중인 행사'가 같이 쓴다.
export function endedDaysOf(row: { startsAt: Date | null; endsAt: Date | null }, now: Date) {
  const endDay = eventEndDayOf(row)
  if (endDay === null) return null
  return Math.round((Date.parse(koreanDateOf(now)) - Date.parse(endDay)) / DAY_MS)
}

// 행사 머리의 셈(DEC-93): 담당 부서, 건강도, 다음 일정, 끝난 지 며칠. 저장하지 않고 읽을 때 센다.
export async function eventHeaderOf(
  db: Reader,
  actor: Actor,
  row: { id: string; startsAt: Date | null; endsAt: Date | null },
  scope: { status: EventStatus; now: Date },
): Promise<Header> {
  const tasks = await openTasksOf(db, actor, scope.now, row.id)
  return {
    departments: departmentsOf(tasks),
    health: {
      overdue: tasks.filter(item => item.summary.overdue).length,
      unassigned: tasks.filter(item => item.unassigned).length,
    },
    next: nextScheduleOf(tasks, row.startsAt, scope.now),
    endedDays: scope.status === 'ended' ? endedDaysOf(row, scope.now) : null,
  }
}
