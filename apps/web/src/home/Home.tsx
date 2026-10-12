import { useState, type ReactNode } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { koreanOf, type HomeItem, type MembershipPermissions } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { phaseLabels, phaseTones } from '../events/event-phase'
import ExpenseDetailDialog from '../expenses/ExpenseDetailDialog'
import { pressed } from '../purchases/purchase-view'
import TaskDialogs from '../tasks/TaskDialogs'
import { departmentGroupsOf, eventGroupsOf, eventLineOf, itemKey, rowOf, statusChipsOf, summaryChips, targetOf, taskCountsText,
  type HomeTab, type HomeView } from './home-view'
import { useHome } from './useHome'

type Props = {
  organizationId: string
  permissions: MembershipPermissions
  // 탭이 없으면 행사의 첫 탭(대화)으로 연다.
  onOpenEvent: (eventId: string, tab?: HomeTab) => void
  onOpenReview: () => void
  onCreateEvent: () => void
  // 업무가 바뀌면 옆 메뉴 내 업무 수를 새로 불러오게 알린다.
  onTasksChanged: () => void
}
const frame = (children: ReactNode) => <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
  <div className="mx-auto flex max-w-3xl flex-col gap-4">{children}</div></div>

// 운영 현황(M6). 끝나지 않은 행사의 멈춘 일과 할 차례를 행사별·부서별로 본다. 회장단이 학생회를 열면 첫 화면이다.
export default function Home({ organizationId, permissions, onOpenEvent, onOpenReview, onCreateEvent, onTasksChanged }: Props) {
  const { data, loadError, refresh } = useHome(organizationId)
  const [view, setView] = useState<HomeView>('events')
  const [task, setTask] = useState<{ eventId: string; taskId: string } | null>(null)
  const [expenseId, setExpenseId] = useState<string | null>(null)
  if (!data) return frame(loadError ? <div className="flex flex-col items-start gap-2">
    <StateMessage kind="error">운영 현황을 불러오지 못했어요.</StateMessage>
    <Button variant="outline" size="sm" onClick={refresh}>다시 불러오기</Button>
  </div> : <StateMessage kind="loading">운영 현황을 불러오는 중…</StateMessage>)
  const dialogs = <>
    <TaskDialogs organizationId={organizationId} manageEvents={permissions.manageEvents} target={task} onClose={() => setTask(null)}
      onChanged={() => { refresh(); onTasksChanged() }} onOpenEvent={eventId => onOpenEvent(eventId, 'tasks')} />
    <ExpenseDetailDialog organizationId={organizationId} expenseId={expenseId} finance={permissions.approvePurchases}
      onClose={() => setExpenseId(null)} onChanged={refresh} />
  </>
  if (!data.events.length && !data.items.length) return frame(<Card>
    <EmptyState icon={CalendarDays} title="진행 중인 행사가 없어요" description="행사를 만들면 여기에 진행 상황이 모여요." />
    <div className="flex justify-center pb-10"><Button onClick={onCreateEvent}>새 행사</Button></div>
  </Card>)
  const counts = summaryChips(data.counts)
  const now = koreanOf(new Date())
  function open(item: HomeItem) {
    const target = targetOf(item, permissions)
    if (target.type === 'task') setTask({ eventId: target.eventId, taskId: target.taskId })
    else if (target.type === 'expense') setExpenseId(target.expenseId)
    else if (target.type === 'review') onOpenReview()
    else onOpenEvent(target.eventId, target.tab)
  }
  const rows = (items: HomeItem[]) => <ul className="flex flex-col border-t border-gray-100" aria-label="멈춘 일">{items.map(item => {
    const row = rowOf(item, view, data)
    return <li key={itemKey(item)} className="border-b border-gray-100 last:border-b-0">
      <Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2.5 text-left whitespace-normal"
        onClick={() => open(item)}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium wrap-anywhere text-gray-900">{row.title}</span>
          <span className="text-xs wrap-anywhere text-gray-500">{row.detail}</span>
        </span>
        <ChevronRight aria-hidden className="text-gray-400" />
      </Button>
    </li>
  })}</ul>
  return frame(<>
    <p className="text-sm text-gray-500">끝나지 않은 행사에서 멈춘 일과 할 차례를 모았어요.</p>
    {counts.length ? <ul className="flex flex-wrap gap-1.5" aria-label="멈춘 일 수">
      {counts.map(text => <li key={text}><Badge tone="warning">{text}</Badge></li>)}</ul>
      : <StateMessage kind="empty">멈춘 일이 없어요.</StateMessage>}
    <div role="group" aria-label="운영 현황 보기" className="flex gap-2">
      <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'events'} onClick={() => setView('events')}>행사별</Button>
      <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'departments'} onClick={() => setView('departments')}>부서별</Button>
    </div>
    {data.truncated && <StateMessage kind="notice">멈춘 일이 많아 오래된 것부터 일부만 보여요.</StateMessage>}
    {view === 'events' ? <section aria-label="행사별" className="flex flex-col gap-3">{eventGroupsOf(data).map(group => {
      const name = group.home?.event.name ?? '상시 운영 지출'
      const chips = group.home ? statusChipsOf(group.home, now) : []
      return <article key={group.key} aria-label={name} className={cn(cardClass, 'flex flex-col')}>
        <div className="flex flex-col gap-1.5 p-4">
          {group.home ? <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={phaseTones[group.home.phase]}>{phaseLabels[group.home.phase]}</Badge>
              <h2 className="min-w-0 text-sm">
                <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
                  onClick={() => onOpenEvent(group.home!.event.id)}>{name}</Button>
              </h2>
            </div>
            <p className="text-xs wrap-anywhere text-gray-500">{eventLineOf(group.home, data.today)}</p>
            {chips.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label="상태">
              {chips.map(chip => <li key={chip}><Badge>{chip}</Badge></li>)}</ul>}
          </> : <h2 className="text-sm font-semibold text-gray-900">{name}</h2>}
        </div>
        {group.items.length > 0 && rows(group.items)}
      </article>
    })}</section>
      : <section aria-label="부서별" className="flex flex-col gap-3">{departmentGroupsOf(data).map(group =>
        <article key={group.key} aria-label={group.name} className={cn(cardClass, 'flex flex-col')}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <h2 className="text-sm font-semibold wrap-anywhere text-gray-900">{group.name}</h2>
            <p className="text-xs text-gray-500">{taskCountsText(group.tasks)}</p>
          </div>
          {group.items.length ? rows(group.items) : <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">멈춘 일이 없어요.</p>}
        </article>)}</section>}
    {dialogs}
  </>)
}
