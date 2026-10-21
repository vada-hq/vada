import type { ReactNode } from 'react'
import type { CouncilView, TaskDetail, TaskStatus } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import {
  COUNCIL_TASK_LABEL,
  NO_ASSIGNEE_LABEL,
  detailAssigneeChoices,
  detailDepartmentChoices,
} from './task-form-options'
import { monthDay } from './task-text'
import { TaskPickerRow } from './TaskPickerRow'
import { TaskStatusRow } from './TaskStatusRow'
import type { TaskProblem, TaskWhere } from './useTaskDetail'

type Props = {
  view: CouncilView
  task: TaskDetail
  saving: boolean
  problem: TaskProblem | null
  onForbidden: () => void
  send: (where: TaskWhere, path: string, body: unknown) => Promise<boolean>
}

const assigneeText = (task: TaskDetail) => {
  if (task.assignee === null) return NO_ASSIGNEE_LABEL
  return task.assignee.current ? task.assignee.name : `떠난 사람: ${task.assignee.name}`
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  )
}

type RowProps = Props & { can: (action: TaskDetail['actions'][number]) => boolean }
const errorIn = (problem: TaskProblem | null, where: TaskWhere) =>
  problem?.where === where ? problem.text : undefined

function DepartmentFact({ view, task, saving, problem, onForbidden, send, can }: RowProps) {
  return (
    <Fact label="담당 부서">
      <TaskPickerRow
        label="담당 부서"
        councilId={view.council.id}
        current={task.department?.name ?? COUNCIL_TASK_LABEL}
        currentId={task.department?.id ?? null}
        canChange={can('task.set_department')}
        saving={saving}
        problem={errorIn(problem, 'department')}
        choicesOf={detailDepartmentChoices}
        onForbidden={onForbidden}
        onSave={id => send('department', '/department', { departmentId: id })}
      />
    </Fact>
  )
}

function AssigneeFact({ view, task, saving, problem, onForbidden, send, can }: RowProps) {
  return (
    <Fact label="담당자">
      <TaskPickerRow
        label="담당자"
        councilId={view.council.id}
        current={assigneeText(task)}
        currentId={task.assignee?.id ?? null}
        canChange={can('task.assign')}
        saving={saving}
        problem={errorIn(problem, 'assignee')}
        choicesOf={team => detailAssigneeChoices(team, task)}
        onForbidden={onForbidden}
        onSave={id => send('assignee', '/assignee', { assigneeId: id })}
      />
    </Fact>
  )
}

// 상태, 마감, 담당 부서, 담당자. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
export function TaskFacts(props: Props) {
  const { task, saving, problem, send } = props
  const can = (action: TaskDetail['actions'][number]) => task.actions.includes(action)
  const statusProblem = errorIn(problem, 'status')
  return (
    <dl className="flex flex-col gap-4">
      <Fact label="상태">
        <TaskStatusRow
          status={task.status}
          canChange={can('task.status')}
          saving={saving}
          onChange={(status: TaskStatus) => {
            void send('status', '/status', { status })
          }}
        />
        {statusProblem && (
          <StateMessage kind="error" className="mt-2">
            {statusProblem}
          </StateMessage>
        )}
      </Fact>
      <Fact label="마감">
        <span className="flex flex-wrap items-center gap-2">
          {task.dueDate === null ? '마감 없음' : monthDay(task.dueDate)}
          {task.overdue && <Badge tone="danger">지남</Badge>}
        </span>
      </Fact>
      <DepartmentFact {...props} can={can} />
      <AssigneeFact {...props} can={can} />
    </dl>
  )
}
