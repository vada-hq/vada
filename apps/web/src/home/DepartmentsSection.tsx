import { Network } from 'lucide-react'
import type { HomeDepartment, TaskSummary } from '@vada/contracts'
import HomeSection, { HomeEmpty } from './HomeSection'
import { riskParts } from './risk-parts'
import TaskRow from './TaskRow'

type Props = {
  departments: HomeDepartment[]
  today: string
  // 내 업무에 이미 보이는 업무. 부서 줄에서 뺀다.
  mineIds: Set<string>
  onOpenTask: (taskId: string) => void
  // 업무 화면에서 그 부서의 업무로 간다.
  onSeeAll: (departmentId: string) => void
}

// 지난 업무 다음에 담당자 없는 업무. 둘 다인 업무는 한 번만 둔다.
function blockedTasks(department: HomeDepartment, mineIds: Set<string>) {
  const seen = new Set(mineIds)
  const rows: TaskSummary[] = []
  for (const task of [...department.overdue.tasks, ...department.unassigned.tasks]) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    rows.push(task)
  }
  return rows
}

function Department({
  department,
  today,
  mineIds,
  onOpenTask,
  onSeeAll,
}: Omit<Props, 'departments'> & { department: HomeDepartment }) {
  const { counts } = department
  const rows = blockedTasks(department, mineIds)
  // 머리의 수는 업무 화면 부서 묶음과 같은 기준이다(지남·담당자 없음은 0이면 뺀다).
  const aside = (
    <span className="flex flex-wrap gap-x-2 text-xs text-gray-500">
      <span>진행 중 {counts.inProgress}</span>
      {riskParts(counts)}
    </span>
  )
  return (
    <HomeSection
      id={`home-department-${department.id}`}
      icon={Network}
      title={department.name}
      count={counts.todo + counts.inProgress}
      aside={aside}
      onSeeAll={() => onSeeAll(department.id)}
    >
      {rows.length === 0 && <HomeEmpty>막힌 업무 없음</HomeEmpty>}
      {rows.map(task => (
        <TaskRow key={task.id} task={task} today={today} onOpen={onOpenTask} showAssignee />
      ))}
    </HomeSection>
  )
}

// 내 부서(부장): 직급이 있는 부서마다 끝나지 않은 업무 수와 막힌 업무(지남, 담당자 없음) 줄.
export default function DepartmentsSection({ departments, ...rest }: Props) {
  return (
    <>
      {departments.map(department => (
        <Department key={department.id} department={department} {...rest} />
      ))}
    </>
  )
}
