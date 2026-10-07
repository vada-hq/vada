import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { EventSummary, MembershipSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import EventList from '../events/EventList'
import CreateEventForm from '../events/CreateEventForm'
import { useEvents } from '../events/useEvents'
import EventWorkspace from './EventWorkspace'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type AccountProps } from './WorkspaceSidebar'

type Props = AccountProps & { memberships: MembershipSummary[]; initialOrganizationId?: string }
export default function Workspace({ initialOrganizationId, ...props }: Props) {
  // 초대로 방금 참여한 학생회가 있으면 그 학생회를 먼저 연다.
  const [membershipId, setMembershipId] = useState(() =>
    (props.memberships.find(item => item.organization.id === initialOrganizationId) ?? props.memberships[0])?.id)
  const membership = props.memberships.find(item => item.id === membershipId) ?? props.memberships[0]
  if (!membership) return null
  return <CouncilWorkspace key={`${membership.id}:${membership.organization.id}`} {...props} membership={membership} onMembershipChange={setMembershipId} />
}

function CouncilWorkspace({ membership, onMembershipChange, ...props }: Props & { membership: MembershipSummary; onMembershipChange: (id: string) => void }) {
  const events = useEvents(membership.organization.id)
  const [selected, setSelected] = useState<EventSummary | null>(null)
  const [leaveRisk, setLeaveRisk] = useState(false)
  // 768px 미만에서 옆 메뉴로 연 사이드바. 행사를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  function canLeave() { return !leaveRisk || window.confirm('입력 중이거나 처리 중인 구매요청이 있어요. 이동하면 입력 내용이 사라지고 서버 처리는 계속될 수 있어요. 이동할까요?') }
  useEffect(() => {
    if (!leaveRisk) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [leaveRisk])
  function select(event: EventSummary) {
    if (event.id !== selected?.id && canLeave()) setSelected(event)
    setNavOpen(false)
  }
  // 데스크톱 aside와 휴대폰 옆 메뉴가 같은 내용을 쓴다. 옆 메뉴는 열렸을 때만 그려진다.
  const sidebar = <WorkspaceSidebar {...props} onLogout={() => { if (canLeave()) props.onLogout() }} membership={membership}
    onMembershipChange={id => { if (canLeave()) onMembershipChange(id) }}>
    <EventList events={events.events} loading={events.loading} error={events.loadError} saving={events.saving}
      selectedId={selected?.id} onSelect={select} onRefresh={events.refresh} />
    <CreateEventForm name={events.name} onNameChange={events.setName} saving={events.saving}
      disabled={events.loading || Boolean(events.loadError)} error={events.createError} onSubmit={event => { void events.create(event) }} />
  </WorkspaceSidebar>
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={membership.organization.name} title={selected?.name ?? '행사'} onMenu={() => setNavOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">
        {selected ? <EventWorkspace key={selected.id} event={selected} handlesFinance={membership.department?.handlesFinance ?? false} onLeaveRiskChange={setLeaveRisk} />
          : <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><Card>
            <EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." />
          </Card></div>}
      </main>
    </div>
  </div>
}
