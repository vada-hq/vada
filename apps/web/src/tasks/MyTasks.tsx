import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import type { TaskDetail, TaskSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
import { pressed, todayInSeoul } from '../purchases/purchase-view'
import TaskCard from './TaskCard'
import TaskDetailDialog from './TaskDetailDialog'
import TaskFormDialog from './TaskFormDialog'
import { nextStatus } from './task-view'
import { changeTaskStatus, type MyTasks as State } from './useTasks'

type Props = {
  organizationId: string
  // 부서가 있는 구성원. 아니면 보기만 한다.
  manageEvents: boolean
  state: State
  // 상세의 [행사로 가기]는 그 행사의 업무 탭을 연다.
  onOpenEvent: (eventId: string) => void
}

// 내 업무. 이 학생회에서 내가 맡은 업무를 모든 행사에서 모은다. 학생회를 열면 첫 화면이다.
export default function MyTasks({ organizationId, manageEvents, state, onOpenEvent }: Props) {
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const [opened, setOpened] = useState<TaskSummary | null>(null)
  const [editing, setEditing] = useState<TaskDetail | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  // 수정을 열 때 구성원 목록을 불러온다(부서·담당자 고르기).
  const directory = useOrganizationMembers(organizationId, editing !== null)
  const today = todayInSeoul()
  if (!state.data) return state.loadError ? <div className="flex flex-col items-start gap-2">
    <StateMessage kind="error">내 업무를 불러오지 못했어요.</StateMessage>
    <Button variant="outline" size="sm" onClick={state.refresh}>다시 불러오기</Button>
  </div> : <StateMessage kind="loading">내 업무를 불러오는 중…</StateMessage>
  const list = tab === 'open' ? state.data.open : state.data.done
  // 다음 상태로 넘기고 내 업무를 새로 불러온다(옆 메뉴 수도 같이 바뀐다). 실패해도 새로 불러와 지금 상태를 보인다.
  async function advance(task: TaskSummary) {
    const next = nextStatus[task.status]
    if (!next) return
    setBusyId(task.id)
    setMessage('')
    const result = await changeTaskStatus(organizationId, task.event.id, task.id, { version: task.version, status: next.status })
    setBusyId(null)
    if (!result.ok) setMessage(result.message)
    state.refresh()
  }
  function goToEvent(eventId: string) {
    setOpened(null)
    onOpenEvent(eventId)
  }
  return <div className="flex flex-col gap-4">
    <p className="text-sm text-gray-500">여러 행사에서 내가 맡은 업무예요.</p>
    <div role="group" aria-label="내 업무 보기" className="flex gap-2">
      <Button variant="outline" size="sm" className={pressed} aria-pressed={tab === 'open'} onClick={() => setTab('open')}>할 일 {state.data.open.length}</Button>
      <Button variant="outline" size="sm" className={pressed} aria-pressed={tab === 'done'} onClick={() => setTab('done')}>완료 {state.data.done.length}</Button>
    </div>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {state.data.truncated && tab === 'open' && <StateMessage kind="notice">할 일이 많아 마감일이 가까운 것부터 일부만 보여요.</StateMessage>}
    {list.length === 0 ? <Card><EmptyState icon={ListChecks} title={tab === 'open' ? '맡은 업무가 없어요' : '완료한 업무가 없어요'}
      description={tab === 'open' ? '행사의 업무 탭에서 나에게 맡긴 업무가 여기에 모여요.' : undefined} /></Card>
      : <section aria-label={tab === 'open' ? '할 일' : '완료'} className="grid gap-3 sm:grid-cols-2">
        {list.map(task => <TaskCard key={task.id} task={task} today={today} showEvent manageEvents={manageEvents} busy={busyId === task.id}
          onOpen={() => setOpened(task)} onAdvance={() => void advance(task)} />)}
      </section>}
    <TaskDetailDialog organizationId={organizationId} target={opened ? { eventId: opened.event.id, taskId: opened.id } : null} manageEvents={manageEvents}
      onClose={() => setOpened(null)} onChanged={state.refresh} onDeleted={() => { setOpened(null); state.refresh() }}
      onEdit={task => { setOpened(null); setEditing(task); directory.refresh() }} onOpenEvent={goToEvent} />
    <TaskFormDialog open={editing !== null} organizationId={organizationId} eventId={editing?.event.id ?? ''} task={editing} directory={directory.data}
      directoryError={directory.loadError} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); state.refresh() }} />
  </div>
}
