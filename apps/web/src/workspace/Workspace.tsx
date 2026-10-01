import { useEffect, useState } from 'react'
import type { EventSummary, MembershipSummary } from '@vada/contracts'
import EventWorkspace from './EventWorkspace'
import EventList from '../events/EventList'
import CreateEventForm from '../events/CreateEventForm'
import { useEvents } from '../events/useEvents'
import Sidebar, { type AccountProps } from './Sidebar'
import './Workspace.css'

type Props = AccountProps & { memberships: MembershipSummary[] }
export default function Workspace(props: Props) {
  const [membershipId, setMembershipId] = useState(props.memberships[0]?.id)
  const membership = props.memberships.find(item => item.id === membershipId) ?? props.memberships[0]
  if (!membership) return null
  return <CouncilWorkspace key={`${membership.id}:${membership.organization.id}`} {...props} membership={membership} onMembershipChange={setMembershipId} />
}

function CouncilWorkspace({ membership, onMembershipChange, ...props }: Props & { membership: MembershipSummary; onMembershipChange: (id: string) => void }) {
  const events = useEvents(membership.organization.id)
  const [selected, setSelected] = useState<EventSummary | null>(null)
  const [leaveRisk, setLeaveRisk] = useState(false)
  function canLeave() { return !leaveRisk || window.confirm('입력 중이거나 처리 중인 구매요청이 있어요. 이동하면 입력 내용이 사라지고 서버 처리는 계속될 수 있어요. 이동할까요?') }
  useEffect(() => {
    if (!leaveRisk) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [leaveRisk])
  return <div className="workspace">
    <Sidebar {...props} onLogout={() => { if (canLeave()) props.onLogout() }} membership={membership}
      onMembershipChange={id => { if (canLeave()) onMembershipChange(id) }}>
      <EventList events={events.events} loading={events.loading} error={events.loadError} saving={events.saving}
        selectedId={selected?.id} onSelect={event => { if (event.id !== selected?.id && canLeave()) setSelected(event) }} onRefresh={events.refresh} />
      <CreateEventForm name={events.name} onNameChange={events.setName} saving={events.saving}
        disabled={events.loading || Boolean(events.loadError)} error={events.createError} onSubmit={event => { void events.create(event) }} />
    </Sidebar>
    <main className="workspace-main">
      {selected ? <EventWorkspace key={selected.id} event={selected} handlesFinance={membership.department.handlesFinance} onLeaveRiskChange={setLeaveRisk} />
        : <div className="workspace-welcome"><p className="eyebrow">함께 준비하는 공간</p><h1>행사를 선택해 주세요</h1><p className="hint">왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요.</p></div>}
    </main>
  </div>
}
