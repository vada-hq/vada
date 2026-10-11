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
import EventList from '../events/EventList'
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
import EventWorkspace from './EventWorkspace'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type AccountProps } from './WorkspaceSidebar'

type View = 'tasks' | 'events' | 'members' | 'review' | 'expenses' | 'budget' | 'fees'
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
  // 학생회를 열면 내 업무가 먼저 보인다. 알림 대신 맡은 업무가 눈에 띄게 한다.
  const [view, setView] = useState<View>(initialView ?? 'tasks')
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
  // 행사 화면 머리의 단계 칩(M5a). 날짜로 계산하고, 그릴 때의 시각을 쓴다.
  const phase = view === 'events' && current ? eventPhaseOf(current, koreanOf(new Date())) : null
  // 행사 화면이 처음 열 탭. 옆 메뉴로 고르면 대화, 예산 화면에서 열면 재정, 내 업무에서 열면 업무다.
  const [eventTab, setEventTab] = useState<'chat' | 'tasks' | 'finance'>('chat')
  const [leaveRisk, setLeaveRisk] = useState(false)
  // 768px 미만에서 옆 메뉴로 연 사이드바. 행사를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  function canLeave() { return !leaveRisk || window.confirm('끼룩이가 품목을 담는 중이에요. 이동해도 담는 중인 품목은 서버에서 계속 만들어질 수 있어요. 이동할까요?') }
  useEffect(() => {
    if (!leaveRisk) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [leaveRisk])
  function select(event: EventSummary) {
    // 구성원·구매 검토·사용 내역 화면에는 입력 중인 구매가 없으므로 묻지 않고 행사 화면으로 간다.
    if (view !== 'events') { setEventTab('chat'); setSelected(event); setView('events') }
    else if (event.id !== selected?.id && canLeave()) { setEventTab('chat'); setSelected(event) }
    setNavOpen(false)
  }
  function openTasks() {
    if (view !== 'tasks' && canLeave()) { setView('tasks'); myTasks.refresh() }
    setNavOpen(false)
  }
  // 내 업무에서 행사로 가면 그 행사의 업무 탭을 연다. 내 업무에는 입력 중인 구매가 없으므로 묻지 않는다.
  function openEventTasks(eventId: string) {
    const target = events.events?.find(item => item.id === eventId)
    if (!target) return
    setEventTab('tasks')
    setSelected(target)
    setView('events')
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
  // 예산 화면에서 행사 이름을 누르면 그 행사의 재정 탭을 연다. 예산 화면에는 입력 중인 구매가 없으므로 묻지 않는다.
  function openEventFinance(eventId: string) {
    const target = events.events?.find(item => item.id === eventId)
    if (!target) return
    setEventTab('finance')
    setSelected(target)
    setView('events')
  }
  function openExpenses() {
    if (view !== 'expenses' && canLeave()) { setView('expenses'); expenses.refresh() }
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
    tasksActive={view === 'tasks'} tasksBadge={taskBadge(myTasks.data, todayInSeoul())} onTasks={openTasks}
    membersActive={view === 'members'} unassignedCount={unassigned} onMembers={openMembers}
    reviewActive={view === 'review'} pendingCount={finance && review.data ? review.data.pending.length : null} onReview={finance ? openReview : null}
    budgetActive={view === 'budget'} onBudget={openBudget} expensesActive={view === 'expenses'} onExpenses={openExpenses}
    feesActive={view === 'fees'} onFees={finance ? openFees : null}>
    <EventList events={events.events} loading={events.loading} error={events.loadError} saving={events.saving}
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
        section={view === 'tasks' ? '내 업무' : view === 'members' ? '구성원' : view === 'review' ? '구매' : view === 'expenses' || view === 'budget' || view === 'fees' ? '재정'
          : current?.completedAt ? '기록' : '행사'}
        badge={phase && <Badge tone={phaseTones[phase]}>{phaseLabels[phase]}</Badge>}
        // 회장단만 완료하고 되돌린다. 완료하면 내 업무에서 그 행사의 업무가 빠지므로 새로 불러온다.
        actions={phase && current && membership.permissions.manageOrganization
          ? <EventCompletionControl event={current} onChanged={event => { events.replace(event); myTasks.refresh() }} onStale={events.refresh} />
          : undefined}
        title={view === 'tasks' ? '내 업무' : view === 'members' ? '구성원' : view === 'review' ? '구매 검토' : view === 'expenses' ? '사용 내역' : view === 'budget' ? '예산'
          : view === 'fees' ? '참가비 설정' : selected?.name ?? '행사'}
        onMenu={() => setNavOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'tasks' ? <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl">
          <MyTasks organizationId={membership.organization.id} manageEvents={membership.permissions.manageEvents} state={myTasks}
            onOpenEvent={openEventTasks} /></div></div>
          : view === 'members' ? <Members inviteCode={membership.organization.inviteCode} state={members} />
          : view === 'review' ? <PurchaseReview organizationId={membership.organization.id} state={review} events={events.events ?? []}
            viewerMembershipId={membership.id} />
          : view === 'budget' ? <Budget organizationId={membership.organization.id} finance={finance} onOpenEvent={openEventFinance} />
          : view === 'fees' ? <FeeSettings organizationId={membership.organization.id} />
          : view === 'expenses' ? <Expenses organizationId={membership.organization.id} finance={finance} viewerMembershipId={membership.id}
            events={events.events ?? []} state={expenses} />
          : current ? <EventWorkspace key={current.id} event={current} finance={finance} viewerMembershipId={membership.id}
            events={events.events ?? []} onLeaveRiskChange={setLeaveRisk} manageEvents={membership.permissions.manageEvents}
            onEventChange={events.replace} onEventStale={events.refresh} onTasksChanged={myTasks.refresh} initialTab={eventTab}
            readOnly={Boolean(current.completedAt)} />
          : <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><Card>
            <EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." />
          </Card></div>}
      </main>
    </div>
  </div>
}
