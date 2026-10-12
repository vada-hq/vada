import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { koreanOf, type EventSummary, type MembershipSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import Budget from '../budget/Budget'
import FeeSettings from '../fees/FeeSettings'
import Home from '../home/Home'
import EventList from '../events/EventList'
import EventReport from '../records/EventReport'
import type { OpenTarget } from '../records/Retrospective'
import Records from '../records/Records'
import Expenses from '../expenses/Expenses'
import { useExpenses } from '../expenses/useExpenses'
import CreateEventForm from '../events/CreateEventForm'
import EventCompletionControl from '../events/EventCompletionControl'
import { eventPhaseOf, phaseLabels, phaseTones } from '../events/event-phase'
import { useEvents } from '../events/useEvents'
import Members from '../organization/Members'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
import PurchaseReview from '../purchases/PurchaseReview'
import { todayInSeoul } from '../purchases/purchase-view'
import { usePurchaseReview } from '../purchases/usePurchaseReview'
import MyTasks from '../tasks/MyTasks'
import { taskBadge } from '../tasks/task-view'
import { useMyTasks } from '../tasks/useTasks'
import EventWorkspace, { type EventTab } from './EventWorkspace'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type AccountProps } from './WorkspaceSidebar'

type View = 'home' | 'tasks' | 'events' | 'members' | 'review' | 'expenses' | 'budget' | 'fees' | 'records' | 'report'
type Props = AccountProps & { memberships: MembershipSummary[]; initialOrganizationId?: string; initialView?: View; onMembershipsChanged?: () => void }
export default function Workspace({ initialOrganizationId, initialView, ...props }: Props) {
  // 초대로 방금 참여했거나 방금 만든 학생회가 있으면 그 학생회를 먼저 연다.
  const [membershipId, setMembershipId] = useState(() =>
    (props.memberships.find(item => item.organization.id === initialOrganizationId) ?? props.memberships[0])?.id)
  const membership = props.memberships.find(item => item.id === membershipId) ?? props.memberships[0]
  if (!membership) return null
  return <CouncilWorkspace key={`${membership.id}:${membership.organization.id}`} {...props} membership={membership} onMembershipChange={setMembershipId}
    initialView={membership.organization.id === initialOrganizationId ? initialView : undefined} />
}

// 본인 소속이 서버와 다른지 본다. 부서·직책·권한이 바뀌었을 때만 소속을 다시 불러온다.
function sameMembership(a: MembershipSummary, b: MembershipSummary) {
  return a.department?.id === b.department?.id && a.department?.name === b.department?.name && a.title === b.title
    && a.permissions.manageOrganization === b.permissions.manageOrganization && a.permissions.approvePurchases === b.permissions.approvePurchases
}

function CouncilWorkspace({ membership, onMembershipChange, initialView, onMembershipsChanged, ...props }: Omit<Props, 'initialOrganizationId'> & { membership: MembershipSummary; onMembershipChange: (id: string) => void }) {
  const events = useEvents(membership.organization.id)
  // 회장단은 학생회를 열면 운영 현황(M6)이, 다른 구성원은 내 업무가 먼저 보인다. 알림 대신 할 일이 눈에 띄게 한다.
  const [view, setView] = useState<View>(initialView ?? (membership.permissions.manageOrganization ? 'home' : 'tasks'))
  // 옆 메뉴의 남은 수와 내 업무 화면이 같이 쓴다.
  const myTasks = useMyTasks(membership.organization.id)
  // 회장단은 사이드바에 미배정 수를 보여 주려고 처음부터 불러온다. 다른 사람은 구성원 화면을 열 때 불러온다.
  const members = useOrganizationMembers(membership.organization.id, membership.permissions.manageOrganization || view === 'members')
  const finance = membership.permissions.approvePurchases
  // 구매 승인 권한이 있으면 옆 메뉴의 대기 수를 세려고 처음부터 불러온다.
  const review = usePurchaseReview(membership.organization.id, finance)
  const expenses = useExpenses(membership.organization.id, view === 'expenses')
  const viewer = members.data?.viewer
  const refreshedFor = useRef<MembershipSummary | null>(null)
  // 구성원 화면에서 본인 부서가 바뀌면 소속을 다시 불러와 사이드바와 재정 화면이 새 권한을 따르게 한다.
  // 같은 목록 응답으로는 한 번만 부른다. 다시 불러온 소속이 여전히 다르면 다음 목록 응답을 기다린다.
  useEffect(() => {
    if (!viewer || viewer === refreshedFor.current || sameMembership(viewer, membership)) return
    refreshedFor.current = viewer
    onMembershipsChanged?.()
  }, [viewer, membership, onMembershipsChanged])
  const [selected, setSelected] = useState<EventSummary | null>(null)
  // 고른 행사는 목록의 최신 값으로 보여 준다. 참가자 탭에서 일시·장소를 고치면 목록이 바뀐다.
  const current = selected && (events.events?.find(item => item.id === selected.id) ?? selected)
  // 완료한 행사(M5a)는 옆 메뉴 행사 목록에서 빼고 "기록"에 둔다. 기록 화면은 결과보고서 상태·숫자와 함께 따로 불러온다(M5b).
  const activeEvents = events.events?.filter(item => !item.completedAt) ?? null
  // 결과보고서 화면(M5b)이 보는 행사. 행사 목록의 최신 값으로 보여 준다.
  const [reportEvent, setReportEvent] = useState<EventSummary | null>(null)
  const reportCurrent = reportEvent && (events.events?.find(item => item.id === reportEvent.id) ?? reportEvent)
  // 고치는 중인 회고가 있는지. 다른 화면으로 갈 때 묻는다.
  const [reportDirty, setReportDirty] = useState(false)
  // 행사 화면 머리의 단계 칩(M5a). 날짜로 계산하고, 그릴 때의 시각을 쓴다.
  const phase = view === 'events' && current ? eventPhaseOf(current, koreanOf(new Date())) : null
  // 행사 화면이 처음 열 탭. 옆 메뉴로 고르면 대화, 예산 화면에서 열면 재정, 내 업무에서 열면 업무, 결과보고서에서 열면 그 기록의 탭이다.
  const [eventTab, setEventTab] = useState<EventTab>('chat')
  // 결과보고서의 대화 근거로 행사를 열면 찾을 메시지
  const [eventMessage, setEventMessage] = useState<string | null>(null)
  const [leaveRisk, setLeaveRisk] = useState(false)
  // 768px 미만에서 옆 메뉴로 연 사이드바. 행사를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  function canLeave() {
    if (leaveRisk && !window.confirm('끼룩이가 품목을 담는 중이에요. 이동해도 담는 중인 품목은 서버에서 계속 만들어질 수 있어요. 이동할까요?')) return false
    // 결과보고서(M5b)에 저장하지 않은 글이 있으면 묻는다.
    return !reportDirty || window.confirm('저장하지 않은 회고가 있어요. 이동하면 고친 내용이 사라져요. 이동할까요?')
  }
  useEffect(() => {
    if (!leaveRisk && !reportDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [leaveRisk, reportDirty])
  function select(event: EventSummary) {
    // 다른 화면에서 오면 그 화면에 남은 것(결과보고서의 저장하지 않은 글)을 묻고 행사 화면으로 간다. 기록에서 고른 행사도 같다.
    if (view !== 'events') { if (canLeave()) { setEventTab('chat'); setEventMessage(null); setSelected(event); setView('events') } }
    else if (event.id !== selected?.id && canLeave()) { setEventTab('chat'); setEventMessage(null); setSelected(event) }
    setNavOpen(false)
  }
  // 완료한 행사의 결과보고서를 연다(M5b). 기록 목록과 볼 수만 있는 행사 화면에서 온다.
  function openReport(event: EventSummary) {
    if ((view !== 'report' || reportEvent?.id !== event.id) && canLeave()) { setReportEvent(event); setView('report') }
    setNavOpen(false)
  }
  // 결과보고서에서 볼 수만 있는 행사 화면을 연다. 준비 과정 줄·근거를 눌렀으면 그 탭(대화는 그 메시지)으로 연다.
  function openRecord(event: EventSummary, target?: OpenTarget) {
    if (!canLeave()) return
    setEventTab(target?.tab ?? 'chat')
    setEventMessage(target?.messageId ?? null)
    setSelected(event)
    setView('events')
  }
  function openTasks() {
    if (view !== 'tasks' && canLeave()) { setView('tasks'); myTasks.refresh() }
    setNavOpen(false)
  }
  // 내 업무·예산·운영 현황에서 행사를 그 탭으로 연다. 세 화면에는 입력 중인 것이 없으므로 묻지 않는다.
  function openEventAt(eventId: string, tab: EventTab = 'chat') {
    const target = events.events?.find(item => item.id === eventId)
    if (!target) return
    setEventTab(tab)
    setEventMessage(null)
    setSelected(target)
    setView('events')
  }
  function openHome() {
    if (view !== 'home' && canLeave()) setView('home')
    setNavOpen(false)
  }
  function openMembers() {
    if (view !== 'members' && canLeave()) { setView('members'); members.refresh() }
    setNavOpen(false)
  }
  function openReview() {
    if (view !== 'review' && canLeave()) { setView('review'); review.refresh() }
    setNavOpen(false)
  }
  function openBudget() {
    if (view !== 'budget' && canLeave()) setView('budget')
    setNavOpen(false)
  }
  function openExpenses() {
    if (view !== 'expenses' && canLeave()) { setView('expenses'); expenses.refresh() }
    setNavOpen(false)
  }
  function openRecords() {
    if (view !== 'records' && canLeave()) setView('records')
    setNavOpen(false)
  }
  // 참가비 설정은 열 때마다 새로 불러온다(화면이 새로 그려진다).
  function openFees() {
    if (view !== 'fees' && canLeave()) setView('fees')
    setNavOpen(false)
  }
  // 데스크톱 aside와 휴대폰 옆 메뉴가 같은 내용을 쓴다. 옆 메뉴는 열렸을 때만 그려진다.
  const unassigned = membership.permissions.manageOrganization && members.data ? members.data.members.filter(member => member.departmentId === null).length : null
  const sidebar = <WorkspaceSidebar {...props} onLogout={() => { if (canLeave()) props.onLogout() }} membership={membership}
    onMembershipChange={id => { if (canLeave()) onMembershipChange(id) }}
    homeActive={view === 'home'} onHome={openHome}
    tasksActive={view === 'tasks'} tasksBadge={taskBadge(myTasks.data, todayInSeoul())} onTasks={openTasks}
    membersActive={view === 'members'} unassignedCount={unassigned} onMembers={openMembers}
    reviewActive={view === 'review'} pendingCount={finance && review.data ? review.data.pending.length : null} onReview={finance ? openReview : null}
    budgetActive={view === 'budget'} onBudget={openBudget} expensesActive={view === 'expenses'} onExpenses={openExpenses}
    feesActive={view === 'fees'} onFees={finance ? openFees : null}
    recordsActive={view === 'records' || view === 'report' || (view === 'events' && Boolean(current?.completedAt))} onRecords={openRecords}>
    <EventList events={activeEvents} loading={events.loading} error={events.loadError} saving={events.saving}
      selectedId={view === 'events' ? selected?.id : undefined} onSelect={select} onRefresh={events.refresh} onCreate={() => { setNavOpen(false); setCreateOpen(true) }} />
  </WorkspaceSidebar>
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    {/* 저장 중에는 닫지 않는다. 응답을 기다리는 동안 닫으면 결과를 볼 곳이 없다. */}
    <Dialog open={createOpen} onOpenChange={open => { if (!events.saving) setCreateOpen(open) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>새 행사</DialogTitle><DialogDescription>행사를 만들면 대화방이 함께 생겨요.</DialogDescription></DialogHeader>
        <CreateEventForm name={events.name} onNameChange={events.setName} saving={events.saving}
          disabled={events.loading || Boolean(events.loadError)} error={events.createError} onCancel={() => setCreateOpen(false)}
          onSubmit={event => { void events.create(event).then(created => { if (created) setCreateOpen(false) }) }} />
      </DialogContent>
    </Dialog>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={membership.organization.name}
        section={view === 'home' ? '홈' : view === 'tasks' ? '내 업무' : view === 'members' ? '구성원' : view === 'review' ? '구매' : view === 'expenses' || view === 'budget' || view === 'fees' ? '재정'
          : view === 'records' || view === 'report' || current?.completedAt ? '기록' : '행사'}
        badge={phase && <Badge tone={phaseTones[phase]}>{phaseLabels[phase]}</Badge>}
        // 회장단만 완료하고 되돌린다. 완료하면 내 업무에서 그 행사의 업무가 빠지므로 새로 불러온다.
        actions={phase && current && membership.permissions.manageOrganization
          ? <EventCompletionControl event={current} onChanged={event => { events.replace(event); myTasks.refresh() }} onStale={events.refresh} />
          : undefined}
        title={view === 'home' ? '운영 현황' : view === 'tasks' ? '내 업무' : view === 'members' ? '구성원' : view === 'review' ? '구매 검토' : view === 'expenses' ? '사용 내역' : view === 'budget' ? '예산'
          : view === 'fees' ? '참가비 설정' : view === 'records' ? '기록' : view === 'report' ? reportCurrent?.name ?? '결과보고서' : selected?.name ?? '행사'}
        onMenu={() => setNavOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'home' ? <Home organizationId={membership.organization.id} permissions={membership.permissions} onOpenEvent={openEventAt}
          onOpenReview={openReview} onCreateEvent={() => setCreateOpen(true)} onTasksChanged={myTasks.refresh} />
          : view === 'tasks' ? <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl">
          <MyTasks organizationId={membership.organization.id} manageEvents={membership.permissions.manageEvents} state={myTasks}
            onOpenEvent={eventId => openEventAt(eventId, 'tasks')} /></div></div>
          : view === 'members' ? <Members inviteCode={membership.organization.inviteCode} state={members} />
          : view === 'review' ? <PurchaseReview organizationId={membership.organization.id} state={review} events={events.events ?? []}
            viewerMembershipId={membership.id} />
          : view === 'budget' ? <Budget organizationId={membership.organization.id} finance={finance} onOpenEvent={eventId => openEventAt(eventId, 'finance')} />
          : view === 'fees' ? <FeeSettings organizationId={membership.organization.id} />
          : view === 'records' ? <Records organizationId={membership.organization.id} onOpen={openReport} />
          : view === 'report' && reportCurrent ? <EventReport key={reportCurrent.id} organizationId={membership.organization.id} eventId={reportCurrent.id}
            canWrite={membership.permissions.manageEvents} onOpenEvent={target => openRecord(reportCurrent, target)} onDirtyChange={setReportDirty}
            onEvent={events.replace} />
          : view === 'expenses' ? <Expenses organizationId={membership.organization.id} finance={finance} viewerMembershipId={membership.id}
            events={events.events ?? []} state={expenses} />
          : current ? <EventWorkspace key={current.id} event={current} finance={finance} viewerMembershipId={membership.id}
            events={events.events ?? []} onLeaveRiskChange={setLeaveRisk} manageEvents={membership.permissions.manageEvents}
            onEventChange={events.replace} onEventStale={events.refresh} onTasksChanged={myTasks.refresh} initialTab={eventTab} initialMessageId={eventMessage ?? undefined}
            readOnly={Boolean(current.completedAt)} onOpenReport={current.completedAt ? () => openReport(current) : undefined} />
          : <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><Card>
            <EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." />
          </Card></div>}
      </main>
    </div>
  </div>
}
