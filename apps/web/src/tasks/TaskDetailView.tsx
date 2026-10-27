import type { TaskAction, TaskDetail, TaskResultKind } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { SidePanelSection } from '@/components/ui/side-panel'
import { monthDayTime } from '@/lib/korean-date-text'
import type { TaskEdit } from './task-edits'
import { errorIn, TaskFactGrid, type TaskPickOptions } from './TaskFactGrid'
import { TaskInlineText } from './TaskInlineText'
import { TaskResultList, type ResultsLayout } from './TaskResultList'
import { TaskStatusSwitch } from './TaskStatusSwitch'
import type { TaskProblem } from './useTaskDetail'

export type TaskDetailViewProps = {
  task: TaskDetail
  // 오늘(한국 날짜). 마감 빠른 날과 달력의 오늘 표시에 쓴다.
  today: string
  busy: boolean
  problem: TaskProblem | null
  options: TaskPickOptions
  results: ResultsLayout
  // 바꾼 값 하나를 보낸다. 성공하면 true.
  onEdit: (edit: TaskEdit) => Promise<boolean> | boolean
  onMake: (kind: TaskResultKind) => void
  // 행사 고르기 창을 처음 열 때. 이을 수 있는 행사를 그때 읽는다.
  onNeedEvents?: (() => void) | undefined
  onOpenEvent?: ((eventId: string) => void) | undefined
}

// 업무 상세의 몸통(와이어프레임 OPS 패널·EVT-TASK-02의 차례): 상태, 사실 칸 넷(담당자·마감·담당 부서·행사), 설명, 결과물, 만든 사람.
// 모든 칸은 그 자리에서 고치고 바로 반영한다. 고치는 단추는 서버가 준 actions로만 보이거나 숨는다(DEC-38).
export function TaskDetailView(props: TaskDetailViewProps) {
  const { task, today, busy, problem, options, onEdit } = props
  const can = (action: TaskAction) => task.actions.includes(action)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <TaskStatusSwitch
          status={task.status}
          canChange={can('task.change_status')}
          busy={busy}
          onChange={status => void onEdit({ field: 'status', status })}
        />
        {errorIn(problem, 'status') && (
          <StateMessage kind="error">{errorIn(problem, 'status')}</StateMessage>
        )}
      </div>
      <TaskFactGrid
        task={task}
        today={today}
        busy={busy}
        problem={problem}
        options={options}
        onEdit={onEdit}
        onNeedEvents={props.onNeedEvents}
        onOpenEvent={props.onOpenEvent}
      />
      <SidePanelSection title="설명">
        <TaskInlineText
          field="body"
          value={task.body}
          editable={can('task.edit')}
          busy={busy}
          problem={errorIn(problem, 'body')}
          onSave={body => onEdit({ field: 'body', body })}
        />
        {!task.body && !can('task.edit') && <p className="text-sm text-gray-400">설명 없음</p>}
      </SidePanelSection>
      <TaskResultList task={task} layout={props.results} busy={busy} onMake={props.onMake} />
      {task.createdBy && (
        <p className="text-xs text-gray-400">
          {task.createdBy.name} · {monthDayTime(task.createdAt)} 만듦
        </p>
      )}
    </div>
  )
}
