import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { CoupangLink, EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import EventPurchases, { type PurchaseView } from '../purchases/EventPurchases'
import ProductPanel from '../purchases/ProductPanel'
import { useCandidates } from '../purchases/useCandidates'
import { useEventPurchases } from '../purchases/useEventPurchases'
import RegistrationPanel from '../registrations/RegistrationPanel'
import { useRegistration } from '../registrations/useRegistration'
import EventFinance from '../settlement/EventFinance'
import { useEventFinance } from '../settlement/useEventFinance'
import EventTasks from '../tasks/EventTasks'
import { useEventTasks } from '../tasks/useTasks'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'

// 와이어프레임 탭 순서처럼 업무를 앞쪽(대화 다음)에, 인원 관리(참가자)를 재정 바로 앞에 둔다. 참가자는 부서가 있는 구성원에게만 보인다.
const tabs = { chat: '대화', tasks: '업무', purchases: '구매', registrations: '참가자', finance: '재정' } as const
type Tab = keyof typeof tabs
export type EventTab = Tab
type Props = { event: EventSummary; finance: boolean; viewerMembershipId: string; events: EventSummary[]; onLeaveRiskChange: (risk: boolean) => void
  // 행사 일시·장소와 참가 신청을 관리하는지(부서가 있는 구성원)
  manageEvents: boolean
  // 참가자 탭에서 행사 정보를 고치면 바뀐 행사를 넘기고, 남이 먼저 바꿨으면 행사 목록을 다시 받게 한다.
  onEventChange: (event: EventSummary) => void; onEventStale: () => void
  // 업무가 바뀌면 내 업무(옆 메뉴 수)를 새로 불러오게 알린다.
  onTasksChanged?: () => void
  // 예산 화면에서 행사 이름을 누르면 재정 탭으로, 내 업무에서 행사로 가면 업무 탭으로, 결과보고서에서는 그 기록의 탭으로 연다.
  initialTab?: Tab
  // 결과보고서의 대화 근거를 누르면 그 메시지를 찾는다.
  initialMessageId?: string
  // 완료한 행사(M5a)는 볼 수만 있다. 탭마다 바꾸는 단추를 감추고, 서버도 막는다.
  readOnly?: boolean
  // 완료한 행사의 결과보고서를 연다(M5b).
  onOpenReport?: () => void }

export default function EventWorkspace({ event, finance, viewerMembershipId, events, onLeaveRiskChange, manageEvents, onEventChange, onEventStale,
  onTasksChanged = () => {}, initialTab, initialMessageId, readOnly = false, onOpenReport }: Props) {
  const order = (Object.keys(tabs) as Tab[]).filter(value => value !== 'registrations' || manageEvents)
  const [tab, setTab] = useState<Tab>(initialTab === 'registrations' && !manageEvents ? 'chat' : initialTab ?? 'chat')
  // 결과보고서에서 구매로 오면 제출된 품목(행사 전체)을 연다.
  const [view, setView] = useState<PurchaseView>(initialTab === 'purchases' ? 'all' : 'candidates')
  // 구매 목록은 구매 탭을 처음 열 때, 후보는 구매 탭이나 링크 패널을 처음 열 때 불러온다.
  const [opened, setOpened] = useState(initialTab === 'purchases')
  // 재정은 재정 탭을 처음 열 때 불러오고, 다른 화면에서 바뀌었을 수 있어 다시 고를 때마다 새로 불러온다.
  const [financeOpened, setFinanceOpened] = useState(initialTab === 'finance')
  // 참가자는 처음 열 때 불러오고, 공개 신청으로 바뀌었을 수 있어 다시 고를 때마다 새로 불러온다.
  const [registrationsOpened, setRegistrationsOpened] = useState(initialTab === 'registrations' && manageEvents)
  // 업무도 처음 열 때 불러오고, 다른 사람이 바꿨을 수 있어 다시 고를 때마다 새로 불러온다.
  const [tasksOpened, setTasksOpened] = useState(initialTab === 'tasks')
  const [link, setLink] = useState<CoupangLink | null>(null)
  const [focus, setFocus] = useState<{ id: number; messageId: string } | null>(initialMessageId ? { id: 0, messageId: initialMessageId } : null)
  const purchases = useEventPurchases(event.organizationId, event.id, opened)
  const candidates = useCandidates(event.organizationId, event.id, opened || link !== null,
    (tab === 'purchases' && view === 'candidates') || link !== null)
  const financeState = useEventFinance(event.organizationId, event.id, financeOpened)
  const registrationState = useRegistration(event.organizationId, event.id, registrationsOpened)
  const taskState = useEventTasks(event.organizationId, event.id, tasksOpened)
  const risk = purchases.generating
  useEffect(() => { onLeaveRiskChange(risk) }, [risk, onLeaveRiskChange])
  useEffect(() => () => onLeaveRiskChange(false), [onLeaveRiskChange])
  const prefix = useId()
  function select(next: Tab) {
    setTab(next)
    if (next === 'purchases') setOpened(true)
    if (next === 'finance') {
      if (financeOpened) financeState.refresh()
      else setFinanceOpened(true)
    }
    if (next === 'registrations') {
      if (registrationsOpened) registrationState.refresh()
      else setRegistrationsOpened(true)
    }
    if (next === 'tasks') {
      if (tasksOpened) taskState.refresh()
      else setTasksOpened(true)
    }
  }
  function navigate(keyboard: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboard.key)) return
    keyboard.preventDefault()
    const index = order.indexOf(tab)
    const next = keyboard.key === 'Home' ? order[0]! : keyboard.key === 'End' ? order[order.length - 1]!
      : order[(index + (keyboard.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length]!
    select(next)
    document.getElementById(`${prefix}-${next}-tab`)?.focus()
  }
  // 대화의 링크를 열면 후보를 바로 새로 불러온다. 방금 올린 링크도 패널에서 찾는다.
  function openLink(next: CoupangLink) { setLink(next); candidates.refresh() }
  // 후보의 공유 표시를 누르면 대화 탭으로 가서 그 메시지를 찾는다.
  function showMessage(messageId: string) { setTab('chat'); setFocus({ id: Date.now(), messageId }) }
  // 행사 이름은 WorkspaceHeader의 제목이 보여 준다. 대화 탭은 흰 바탕 전체 화면, 구매·재정 탭은 gray-50 본문에 여백을 둔다.
  return <>
    <div className="flex shrink-0 gap-0.5 border-b bg-white px-4 sm:px-6" role="tablist" aria-label="행사 작업">
      {order.map(value => <TabButton key={value} id={`${prefix}-${value}-tab`}
        aria-selected={tab === value} aria-controls={`${prefix}-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={navigate}>{tabs[value]}</TabButton>)}
    </div>
    {readOnly && <div className="flex shrink-0 items-center gap-2 border-b bg-gray-50 px-4 py-2 sm:px-6">
      <p className="min-w-0 flex-1 text-xs text-gray-600">완료한 행사라 볼 수만 있어요.</p>
      {onOpenReport && <Button variant="link" size="sm" className="h-auto p-0" onClick={onOpenReport}>결과보고서</Button>}
    </div>}
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매·재정 화면 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="flex min-h-0 flex-1 flex-col bg-white" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} onOpenLink={openLink} focus={focus} readOnly={readOnly} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-tasks-panel`} aria-labelledby={`${prefix}-tasks-tab`} hidden={tab !== 'tasks'}>
      {tasksOpened && <div className="mx-auto max-w-5xl"><EventTasks organizationId={event.organizationId} event={event} manageEvents={manageEvents}
        viewerMembershipId={viewerMembershipId} state={taskState} onChanged={onTasksChanged} readOnly={readOnly} /></div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {opened && <div className="mx-auto max-w-3xl"><EventPurchases state={purchases} candidates={candidates} view={view}
        onViewChange={setView} onShowMessage={showMessage} readOnly={readOnly} /></div>}
    </div>
    {manageEvents && <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-registrations-panel`}
      aria-labelledby={`${prefix}-registrations-tab`} hidden={tab !== 'registrations'}>
      {registrationsOpened && <div className="mx-auto max-w-3xl"><RegistrationPanel organizationId={event.organizationId} event={event}
        state={registrationState} onEventChange={onEventChange} onEventStale={onEventStale} readOnly={readOnly} /></div>}
    </div>}
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-finance-panel`} aria-labelledby={`${prefix}-finance-tab`} hidden={tab !== 'finance'}>
      {financeOpened && <div className="mx-auto max-w-3xl"><EventFinance organizationId={event.organizationId} eventId={event.id} finance={finance}
        viewerMembershipId={viewerMembershipId} events={events} state={financeState} readOnly={readOnly} /></div>}
    </div>
    <ProductPanel link={link} candidates={candidates} onClose={() => setLink(null)} />
  </>
}
