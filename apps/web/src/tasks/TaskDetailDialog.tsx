import { useState } from 'react'
import type { CouncilView, TaskAction, TaskDetail } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TASK_LOAD_FAILED } from '@/lib/messages'
import type { TaskDialogHandlers } from './task-requests'
import { TaskEditForm } from './TaskEditForm'
import { TaskFacts } from './TaskFacts'
import { TaskHistory } from './TaskHistory'
import { useTaskDetail } from './useTaskDetail'

type Props = TaskDialogHandlers & {
  view: CouncilView
  // 열린 업무의 번호. null이면 닫혀 있다. 카드를 눌러 열고 닫는 일은 부모가 한다.
  taskId: string | null
  onClose: () => void
  onOpenEvent?: ((eventId: string) => void) | undefined
}

// 업무 상세 대화상자. 열려 있을 때만 읽고, 업무가 바뀌면 처음부터 다시 읽는다.
export function TaskDetailDialog({ taskId, ...props }: Props) {
  if (taskId === null) return null
  return <OpenTaskDialog key={taskId} taskId={taskId} {...props} />
}

function OpenTaskDialog({
  view,
  taskId,
  onClose,
  onOpenEvent,
  ...handlers
}: Props & { taskId: string }) {
  const detail = useTaskDetail(view.council.id, taskId, handlers)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !detail.saving) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{detail.task?.title ?? '업무'}</DialogTitle>
        </DialogHeader>
        {detail.task ? (
          <Loaded
            view={view}
            task={detail.task}
            detail={detail}
            onForbidden={handlers.onForbidden}
            onOpenEvent={onOpenEvent}
            onClose={onClose}
          />
        ) : detail.loadFailed ? (
          <div className="flex flex-col items-start gap-3">
            <StateMessage kind="error">{TASK_LOAD_FAILED}</StateMessage>
            <Button variant="outline" onClick={detail.retry}>
              다시 시도
            </Button>
          </div>
        ) : (
          <StateMessage kind="loading">불러오는 중이에요</StateMessage>
        )}
      </DialogContent>
    </Dialog>
  )
}

type LoadedProps = {
  view: CouncilView
  task: TaskDetail
  detail: ReturnType<typeof useTaskDetail>
  onForbidden: () => void
  onOpenEvent: Props['onOpenEvent']
  onClose: () => void
}

function Loaded({ view, task, detail, onForbidden, onOpenEvent, onClose }: LoadedProps) {
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <TaskEditForm
        councilId={view.council.id}
        onForbidden={onForbidden}
        task={task}
        saving={detail.saving}
        problem={detail.problem?.where === 'edit' ? detail.problem.text : undefined}
        onCancel={() => {
          detail.clearProblem()
          setEditing(false)
        }}
        onSave={async request => {
          const done = await detail.send('edit', '', request)
          if (done) setEditing(false)
          return done
        }}
      />
    )
  return (
    <div className="flex flex-col gap-6">
      <TaskFacts
        view={view}
        task={task}
        saving={detail.saving}
        problem={detail.problem}
        onForbidden={onForbidden}
        onOpenEvent={onOpenEvent}
        send={detail.send}
      />
      {task.body && (
        <p className="text-sm wrap-anywhere whitespace-pre-wrap text-gray-800">{task.body}</p>
      )}
      {(task.actions.includes('task.edit') || task.actions.includes('task.remove')) && (
        <ManageButtons
          detail={detail}
          actions={task.actions}
          onEdit={() => setEditing(true)}
          onDeleted={onClose}
        />
      )}
      <TaskHistory history={task.history} />
    </div>
  )
}

type ManageProps = {
  detail: ReturnType<typeof useTaskDetail>
  actions: TaskAction[]
  onEdit: () => void
  onDeleted: () => void
}

// [고치기]와 [지우기]. 지우기는 확인을 한 번 거친다.
function ManageButtons({ detail, actions, onEdit, onDeleted }: ManageProps) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.includes('task.edit') && (
        <Button variant="outline" disabled={detail.saving} onClick={onEdit}>
          고치기
        </Button>
      )}
      {actions.includes('task.remove') && (
        <Button variant="outline" disabled={detail.saving} onClick={() => setDeleting(true)}>
          지우기
        </Button>
      )}
      <ConfirmDialog
        open={deleting}
        destructive
        busy={detail.saving}
        error={detail.problem?.where === 'delete' ? detail.problem.text : ''}
        title="이 업무를 지울까요?"
        description="지운 업무는 목록에서 사라지고 되살릴 수 없어요."
        confirmLabel="지우기"
        onClose={() => {
          detail.clearProblem()
          setDeleting(false)
        }}
        onConfirm={() => {
          void detail.send('delete', '/delete', {}).then(done => {
            if (done) onDeleted()
          })
        }}
      />
    </div>
  )
}
