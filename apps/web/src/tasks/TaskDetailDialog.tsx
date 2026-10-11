import { useEffect, useState } from 'react'
import { TASK_STATUSES, type EventTasksResponse, type TaskDetail, type TaskStatus } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pressed, timeText, todayInSeoul } from '../purchases/purchase-view'
import { dueText, isOverdue, statusLabels, taskHistoryText } from './task-view'
import { changeTaskStatus, deleteTask, fetchTask } from './useTasks'

type Target = { eventId: string; taskId: string }
type Props = {
  organizationId: string
  target: Target | null
  // 부서가 있는 구성원. 아니면 보기만 한다.
  manageEvents: boolean
  onClose: () => void
  onChanged: (task: TaskDetail) => void
  // 지운 뒤 그 행사의 남은 업무 목록을 넘긴다.
  onDeleted: (list: EventTasksResponse) => void
  onEdit: (task: TaskDetail) => void
  // 내 업무에서 열었을 때 그 행사의 업무 탭으로 간다.
  onOpenEvent?: (eventId: string) => void
}

// 업무 상세. 상태를 바로 바꾸고, 수정·지우기를 하고, 처리 기록을 본다.
export default function TaskDetailDialog({ target, onClose, ...props }: Props) {
  return <Dialog open={target !== null} onOpenChange={open => { if (!open) onClose() }}>
    {target && <DialogContent><Detail key={target.taskId} target={target} {...props} /></DialogContent>}
  </Dialog>
}

function Detail({ organizationId, target, manageEvents, onChanged, onDeleted, onEdit, onOpenEvent }: Omit<Props, 'target' | 'onClose'> & { target: Target }) {
  const [task, setTask] = useState<TaskDetail | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    void fetchTask(organizationId, target.eventId, target.taskId).then(value => { if (current) setTask(value) })
    return () => { current = false }
  }, [organizationId, target.eventId, target.taskId])
  if (task === undefined) return <>
    <DialogHeader><DialogTitle>업무</DialogTitle><DialogDescription>불러오는 중…</DialogDescription></DialogHeader>
    <StateMessage kind="loading">불러오는 중…</StateMessage>
  </>
  if (task === null) return <>
    <DialogHeader><DialogTitle>업무</DialogTitle><DialogDescription>상세를 볼 수 없어요.</DialogDescription></DialogHeader>
    <StateMessage kind="error">업무를 불러오지 못했어요. 지워졌을 수 있어요.</StateMessage>
  </>
  const current = task
  async function changeStatus(status: TaskStatus) {
    if (status === current.status) return
    setBusy(true)
    setMessage('')
    const result = await changeTaskStatus(organizationId, current.event.id, current.id, { version: current.version, status })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setTask(result.task)
    onChanged(result.task)
  }
  async function remove() {
    setBusy(true)
    setMessage('')
    const result = await deleteTask(organizationId, current.event.id, current.id, current.version)
    setBusy(false)
    if (!result.ok) { setMessage(result.message); setConfirming(false); return }
    onDeleted(result.list)
  }
  const overdue = isOverdue(current, todayInSeoul())
  const fields: [string, string][] = [['행사', current.event.name], ['담당 부서', current.department?.name ?? '없음'],
    ['담당자', current.assignee?.name ?? '없음'], ['마감일', current.dueOn ? `${dueText(current.dueOn)}${overdue ? ' · 지연' : ''}` : '없음'],
    ['만든 사람', current.createdBy.name]]
  return <>
    <DialogHeader>
      <DialogTitle className="wrap-anywhere">{current.title}</DialogTitle>
      <DialogDescription>{statusLabels[current.status]}{current.completedAt ? ` · ${timeText(current.completedAt)} 완료` : ''}</DialogDescription>
    </DialogHeader>
    {manageEvents && <div role="group" aria-label="상태" className="flex flex-wrap gap-2">
      {TASK_STATUSES.map(status => <Button key={status} variant="outline" size="sm" className={pressed} aria-pressed={current.status === status}
        disabled={busy} onClick={() => void changeStatus(status)}>{statusLabels[status]}</Button>)}
    </div>}
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">{fields.map(([label, value]) => <div key={label} className="contents">
      <dt className="text-gray-500">{label}</dt>
      <dd className={label === '마감일' && overdue ? 'col-span-2 font-medium text-destructive' : 'col-span-2 wrap-anywhere text-gray-900'}>{value}</dd>
    </div>)}</dl>
    {current.description && <p className="text-sm whitespace-pre-wrap wrap-anywhere text-gray-700">{current.description}</p>}
    <section aria-label="처리 기록" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">처리 기록</h3>
      <ol className="flex flex-col gap-0.5 text-xs text-gray-600">{current.history.map(entry => <li key={entry.id} className="wrap-anywhere">
        {entry.actor.name} · {timeText(entry.createdAt)} · {taskHistoryText(entry)}</li>)}</ol>
    </section>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {confirming
      ? <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-700">이 업무를 지울까요? 처리 기록도 함께 지워져요.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>돌아가기</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void remove()}>지우기</Button>
        </div>
      </div>
      : (manageEvents || onOpenEvent) && <DialogFooter>
        {onOpenEvent && <Button variant="outline" onClick={() => onOpenEvent(current.event.id)}>행사로 가기</Button>}
        {manageEvents && <Button variant="outline" disabled={busy} onClick={() => onEdit(current)}>수정</Button>}
        {manageEvents && <Button variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>지우기</Button>}
      </DialogFooter>}
  </>
}
