import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { CoupangLink, EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import EventPurchases, { type PurchaseView } from '../purchases/EventPurchases'
import ProductPanel from '../purchases/ProductPanel'
import { useCandidates } from '../purchases/useCandidates'
import { useEventPurchases } from '../purchases/useEventPurchases'
import EventFinance from '../settlement/EventFinance'
import { useEventFinance } from '../settlement/useEventFinance'
import { TabButton } from '@/components/ui/tab-button'

const tabs = { chat: '대화', purchases: '구매', finance: '재정' } as const
type Tab = keyof typeof tabs
const order = Object.keys(tabs) as Tab[]
type Props = { event: EventSummary; finance: boolean; viewerMembershipId: string; events: EventSummary[]; onLeaveRiskChange: (risk: boolean) => void
  // 예산 화면에서 행사 이름을 누르면 재정 탭으로 연다.
  initialTab?: 'chat' | 'finance' }

export default function EventWorkspace({ event, finance, viewerMembershipId, events, onLeaveRiskChange, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'chat')
  const [view, setView] = useState<PurchaseView>('candidates')
  // 구매 목록은 구매 탭을 처음 열 때, 후보는 구매 탭이나 링크 패널을 처음 열 때 불러온다.
  const [opened, setOpened] = useState(false)
  // 재정은 재정 탭을 처음 열 때 불러오고, 다른 화면에서 바뀌었을 수 있어 다시 고를 때마다 새로 불러온다.
  const [financeOpened, setFinanceOpened] = useState(initialTab === 'finance')
  const [link, setLink] = useState<CoupangLink | null>(null)
  const [focus, setFocus] = useState<{ id: number; messageId: string } | null>(null)
  const purchases = useEventPurchases(event.organizationId, event.id, opened)
  const candidates = useCandidates(event.organizationId, event.id, opened || link !== null,
    (tab === 'purchases' && view === 'candidates') || link !== null)
  const financeState = useEventFinance(event.organizationId, event.id, financeOpened)
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
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매·재정 화면 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="flex min-h-0 flex-1 flex-col bg-white" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} onOpenLink={openLink} focus={focus} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {opened && <div className="mx-auto max-w-3xl"><EventPurchases state={purchases} candidates={candidates} view={view}
        onViewChange={setView} onShowMessage={showMessage} /></div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-finance-panel`} aria-labelledby={`${prefix}-finance-tab`} hidden={tab !== 'finance'}>
      {financeOpened && <div className="mx-auto max-w-3xl"><EventFinance organizationId={event.organizationId} eventId={event.id} finance={finance}
        viewerMembershipId={viewerMembershipId} events={events} state={financeState} /></div>}
    </div>
    <ProductPanel link={link} candidates={candidates} onClose={() => setLink(null)} />
  </>
}
