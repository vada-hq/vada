import {
  HOME_CONGESTION_TASKS,
  HOME_SOON_DAYS,
  daysBetween,
  koreanDateOf,
  type HomeCongestion,
  type TaskSummary,
} from '@vada/contracts'
import type { OpenTask } from '../tasks/open-tasks.js'
import type { DepartmentMember } from './department-members.js'

function candidateOf(task: TaskSummary, members: DepartmentMember[], today: string) {
  const assignee = task.assignee
  const dept = task.department?.id
  if (!assignee?.current || !dept || !task.dueDate) return null
  const days = daysBetween(today, task.dueDate)
  if (days < 0 || days > HOME_SOON_DAYS) return null
  return members.some(row => row.memberId === assignee.id && row.departmentId === dept)
    ? { assignee, dept, dueDate: task.dueDate }
    : null
}

// 동률은 첫 마감, 이름, ID 순으로 안정시킨다. 제품에는 순위·점수를 보이지 않는다.
export function congestionOf(
  open: OpenTask[],
  members: DepartmentMember[],
  now: Date,
): HomeCongestion | null {
  const today = koreanDateOf(now)
  const people = new Map<string, HomeCongestion>()
  for (const { summary: task } of open) {
    const candidate = candidateOf(task, members, today)
    if (!candidate) continue
    const { assignee, dept, dueDate } = candidate
    const previous = people.get(assignee.id)
    if (!previous)
      people.set(assignee.id, {
        member: { id: assignee.id, name: assignee.name },
        departmentIds: [dept],
        count: 1,
        firstDue: dueDate,
        lastDue: dueDate,
      })
    else {
      previous.count++
      previous.firstDue = [previous.firstDue, dueDate].sort()[0]!
      previous.lastDue = [previous.lastDue, dueDate].sort()[1]!
      previous.departmentIds = [...new Set([...previous.departmentIds, dept])].sort()
    }
  }
  return (
    [...people.values()]
      .filter(row => row.count >= HOME_CONGESTION_TASKS)
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.firstDue.localeCompare(b.firstDue) ||
          a.member.name.localeCompare(b.member.name) ||
          a.member.id.localeCompare(b.member.id),
      )[0] ?? null
  )
}
