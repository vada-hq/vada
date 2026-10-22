import type { HomeList } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import TaskRow from './TaskRow'

type Props = {
  label: string
  list: HomeList
  onOpenTask: (taskId: string) => void
  onSeeAll: () => void
  showDepartment?: boolean
}

// 지난 업무나 담당자 없는 업무 목록: 이름과 전체 수, 줄, 업무 화면으로 가는 '모두 보기'. 없으면 그리지 않는다.
export default function TaskLines({
  label,
  list,
  onOpenTask,
  onSeeAll,
  showDepartment = false,
}: Props) {
  if (list.total === 0) return null
  return (
    <div role="group" aria-label={`${label} ${list.total}개`} className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-2">
        <h4 className="text-xs font-semibold text-gray-500">
          {label} {list.total}
        </h4>
        <Button variant="link" size="sm" className="px-0" onClick={onSeeAll}>
          모두 보기
        </Button>
      </div>
      <ul className="flex flex-col">
        {list.tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onOpen={onOpenTask}
            showAssignee
            showDepartment={showDepartment}
          />
        ))}
      </ul>
    </div>
  )
}
