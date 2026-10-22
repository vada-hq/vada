import type { HomeDepartment } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Card } from '@/components/ui/card'
import { NO_ASSIGNEE_LABEL } from '../tasks/task-view'
import TaskLines from './TaskLines'

type Props = {
  departments: HomeDepartment[]
  onOpenTask: (taskId: string) => void
  // 업무 화면으로 간다.
  onSeeAll: () => void
}

function Department({
  department,
  onOpenTask,
  onSeeAll,
}: Omit<Props, 'departments'> & {
  department: HomeDepartment
}) {
  const { counts } = department
  const open = counts.todo + counts.inProgress
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-gray-900 wrap-anywhere">{department.name}</h2>
      {open === 0 ? (
        <StateMessage kind="empty">끝나지 않은 업무가 없어요.</StateMessage>
      ) : (
        <p className="px-2 text-xs text-gray-500">
          할 일 {counts.todo} · 진행 중 {counts.inProgress} · 지남 {counts.overdue} ·{' '}
          {NO_ASSIGNEE_LABEL} {counts.unassigned}
        </p>
      )}
      <TaskLines
        label="지난 업무"
        list={department.overdue}
        onOpenTask={onOpenTask}
        onSeeAll={onSeeAll}
      />
      <TaskLines
        label="담당자 없는 업무"
        list={department.unassigned}
        onOpenTask={onOpenTask}
        onSeeAll={onSeeAll}
      />
    </Card>
  )
}

// 내 부서(부장): 직급이 있는 부서마다 진행 수와 지난·담당자 없는 업무. 지남과 담당자 없음은 할 일·진행 중 수와 겹치니 더하지 않는다.
export default function DepartmentsSection({ departments, ...rest }: Props) {
  return (
    <section aria-label="내 부서" className="flex flex-col gap-3">
      {departments.map(department => (
        <Department key={department.id} department={department} {...rest} />
      ))}
    </section>
  )
}
