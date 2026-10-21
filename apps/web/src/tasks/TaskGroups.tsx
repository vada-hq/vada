import type { ReactNode } from 'react'
import type { TaskSummary } from '@vada/contracts'
import { groupByDepartment } from './task-view'

// 전체와 담당자 없음: 부서 이름순 묶음, '학생회 업무'는 맨 뒤.
export default function TaskGroups({
  tasks,
  card,
}: {
  tasks: TaskSummary[]
  card: (task: TaskSummary) => ReactNode
}) {
  return (
    <>
      {groupByDepartment(tasks).map(group => (
        <section key={group.key} aria-label={group.name} className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-gray-500 wrap-anywhere">{group.name}</h2>
          <ul className="flex flex-col gap-2">
            {group.tasks.map(task => (
              <li key={task.id}>{card(task)}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
