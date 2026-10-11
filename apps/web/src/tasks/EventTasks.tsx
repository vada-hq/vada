import { useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import type { EventSummary, TaskDetail, TaskStatus, TaskSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
import { pressed, todayInSeoul } from '../purchases/purchase-view'
import TaskCard from './TaskCard'
import TaskDetailDialog from './TaskDetailDialog'
import TaskFormDialog from './TaskFormDialog'
import TaskSchedule from './TaskSchedule'
import { dDayText, filterLabels, matchesFilter, nextStatus, scheduleOf, sortByDue, statusLabels, taskCounts, type TaskFilter } from './task-view'
import { changeTaskStatus, type EventTasks as State } from './useTasks'

type Props = {
  organizationId: string
  event: EventSummary
  // 부서가 있는 구성원. 아니면 보기만 한다.
  manageEvents: boolean
  viewerMembershipId: string
  state: State
  // 업무가 바뀌면 내 업무(옆 메뉴 수)를 새로 불러오게 알린다.
  onChanged: () => void
}
const filters: TaskFilter[] = ['overdue', 'unassigned', 'mine']
const columns: TaskStatus[] = ['todo', 'doing', 'done']
const views = [{ value: 'board', label: '보드' }, { value: 'schedule', label: '일정' }] as const

// 행사 업무 탭. 위에 요약과 거르기, 아래에 보드(상태별) 또는 일정(날짜순).
export default function EventTasks({ organizationId, event, manageEvents, viewerMembershipId, state, onChanged }: Props) {
  const [view, setView] = useState<'board' | 'schedule'>('board')
  const [filter, setFilter] = useState<TaskFilter | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  const [editing, setEditing] = useState<TaskDetail | 'new' | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  // 업무 추가·수정을 열 때 구성원 목록을 불러온다(부서·담당자 고르기).
  const directory = useOrganizationMembers(organizationId, editing !== null)
  const today = todayInSeoul()
  if (!state.data) return state.loadError ? <div className="flex flex-col items-start gap-2">
    <StateMessage kind="error">업무를 불러오지 못했어요.</StateMessage>
    <Button variant="outline" size="sm" onClick={state.refresh}>다시 불러오기</Button>
  </div> : <StateMessage kind="loading">업무를 불러오는 중…</StateMessage>
  const tasks = sortByDue(state.data.tasks)
  const counts = taskCounts(tasks, today, viewerMembershipId)
  const visible = tasks.filter(task => matchesFilter(task, filter, today, viewerMembershipId))
  const dday = dDayText(event.startsAt, today)
  function edit(task: TaskDetail | 'new') {
    setEditing(task)
    directory.refresh()
  }
  function saved(task: TaskDetail) {
    state.replace(task)
    setEditing(null)
    onChanged()
  }
  async function advance(task: TaskSummary) {
    const next = nextStatus[task.status]
    if (!next) return
    setBusyId(task.id)
    setMessage('')
    const result = await changeTaskStatus(organizationId, event.id, task.id, { version: task.version, status: next.status })
    setBusyId(null)
    if (!result.ok) {
      setMessage(result.message)
      // 다른 사람이 먼저 바꿨거나 지웠으면 목록이 오래된 것이다.
      if (result.code === 'VERSION_CONFLICT' || result.code === 'NOT_FOUND') state.refresh()
      return
    }
    state.replace(result.task)
    onChanged()
  }
  const column = (status: TaskStatus) => {
    const items = visible.filter(task => task.status === status)
    const done = status === 'done'
    return <section key={status} aria-label={statusLabels[status]} className="flex min-w-0 flex-col gap-2 rounded-lg bg-gray-100 p-3">
      <h2 className="flex items-center justify-between text-sm font-semibold text-gray-700">{statusLabels[status]}
        <span className="text-xs font-normal text-gray-500">{items.length}</span></h2>
      {/* 열이 쌓이는 폭(1024px 미만)에서는 완료 업무를 접어 둔다. 세 열일 때는 늘 보인다. */}
      {done && items.length > 0 && <Button variant="ghost" size="sm" className="lg:hidden" aria-expanded={showDone}
        onClick={() => setShowDone(value => !value)}>{showDone ? '접기' : `완료 ${items.length}개 보기`}</Button>}
      <div className={cn('flex flex-col gap-2', done && !showDone && 'hidden lg:flex')}>
        {items.map(task => <TaskCard key={task.id} task={task} today={today} manageEvents={manageEvents} busy={busyId === task.id}
          onOpen={() => setOpened(task.id)} onAdvance={() => void advance(task)} />)}
      </div>
    </section>
  }
  return <div className="flex flex-col gap-4">
    <section aria-label="업무 요약" className={cn(cardClass, 'flex flex-wrap items-center gap-x-6 gap-y-3 p-4')}>
      {dday && <p className="text-xl font-bold text-primary">{dday}</p>}
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">완료 {counts.done}/{counts.total}</p>
        {/* Windows Chrome은 progress에 accent-color를 쓰지 않아 막대·채움 색을 직접 준다(WebKit·Blink와 Firefox 둘 다). */}
        {counts.total > 0 && <progress className="h-2 w-32 appearance-none overflow-hidden rounded-full bg-gray-100 [&::-moz-progress-bar]:bg-primary
          [&::-webkit-progress-bar]:bg-gray-100 [&::-webkit-progress-value]:bg-primary" value={counts.done} max={counts.total} aria-label="완료한 업무" />}
      </div>
      <div role="group" aria-label="업무 거르기" className="flex flex-wrap gap-2">
        {filters.map(value => <Button key={value} variant="outline" size="sm"
          className={cn(pressed, value === 'overdue' && counts.overdue > 0 && 'text-destructive')} aria-pressed={filter === value}
          disabled={counts[value] === 0 && filter !== value} onClick={() => setFilter(current => current === value ? null : value)}>
          {filterLabels[value]} {counts[value]}</Button>)}
      </div>
    </section>
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="업무 보기" className="flex gap-2">
        {views.map(option => <Button key={option.value} variant="outline" size="sm" className={pressed} aria-pressed={view === option.value}
          onClick={() => setView(option.value)}>{option.label}</Button>)}
      </div>
      {manageEvents && <Button size="sm" className="ml-auto" onClick={() => edit('new')}><Plus />업무 추가</Button>}
    </div>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {view === 'schedule'
      // 거르는 중에는 걸린 업무만 보인다. 행사·신청 마감 줄은 거르지 않을 때만 넣는다.
      ? <TaskSchedule items={filter === null ? scheduleOf(visible, event, state.data.registrationClosesAt)
        : scheduleOf(visible, { name: event.name, startsAt: null, endsAt: null }, null)} today={today} expandPast={filter !== null}
        onOpen={task => setOpened(task.id)} />
      : tasks.length === 0 ? <Card><EmptyState icon={ListChecks} title="아직 업무가 없어요"
        description={manageEvents ? '업무를 추가해 담당 부서와 담당자, 마감일을 정해 주세요.' : '부서가 있는 구성원이 업무를 추가해요.'} /></Card>
      // 옆 메뉴(210px)가 보이는 768px에서는 카드가 너무 좁아, 세 열은 1024px부터다.
      : <div className="grid gap-3 lg:grid-cols-3">{columns.map(column)}</div>}
    <TaskDetailDialog organizationId={organizationId} target={opened ? { eventId: event.id, taskId: opened } : null} manageEvents={manageEvents}
      onClose={() => setOpened(null)} onChanged={task => { state.replace(task); onChanged() }}
      onDeleted={list => { state.setList(list); setOpened(null); onChanged() }}
      onEdit={task => { setOpened(null); edit(task) }} />
    <TaskFormDialog open={editing !== null} organizationId={organizationId} eventId={event.id} task={editing === 'new' ? null : editing}
      directory={directory.data} directoryError={directory.loadError} onClose={() => setEditing(null)} onSaved={saved} />
  </div>
}
