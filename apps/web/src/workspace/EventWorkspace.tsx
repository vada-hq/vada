import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import Purchases from '../purchases/Purchases'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'

// 재정부 보기 전환 버튼: 눌린 쪽을 활성 메뉴 색으로 보여 준다.
const pressed = 'aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground'

export default function EventWorkspace({ event, handlesFinance, onLeaveRiskChange }: { event: EventSummary; handlesFinance: boolean; onLeaveRiskChange: (risk: boolean) => void }) {
  const [tab, setTab] = useState<'chat' | 'purchases'>('chat')
  const [purchasesOpened, setPurchasesOpened] = useState(false)
  const [financeOpened, setFinanceOpened] = useState(false)
  const [purchaseView, setPurchaseView] = useState<'own' | 'finance'>('own')
  const viewingFinance = handlesFinance && purchaseView === 'finance'
  const [dialogOpen, setDialogOpen] = useState(false)
  const [ownRisk, setOwnRisk] = useState(false)
  const [financeRisk, setFinanceRisk] = useState(false)
  useEffect(() => { onLeaveRiskChange(ownRisk || (handlesFinance && financeRisk)) }, [ownRisk, financeRisk, handlesFinance, onLeaveRiskChange])
  useEffect(() => () => onLeaveRiskChange(false), [onLeaveRiskChange])
  const prefix = useId()
  function select(next: typeof tab) { setTab(next); if (next === 'purchases') setPurchasesOpened(true) }
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'purchases' : tab === 'chat' ? 'purchases' : 'chat'
    select(next)
    document.getElementById(`${prefix}-${next}-tab`)?.focus()
  }
  // 행사 이름은 WorkspaceHeader의 제목이 보여 준다. 대화 탭은 흰 바탕 전체 화면, 구매요청 탭은 gray-50 본문에 여백 21px다.
  return <>
    <div className="flex shrink-0 gap-0.5 border-b bg-white px-4 sm:px-6" role="tablist" aria-label="행사 작업">
      {(['chat', 'purchases'] as const).map(value => <TabButton key={value} id={`${prefix}-${value}-tab`}
        aria-selected={tab === value} aria-controls={`${prefix}-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={navigate}>{value === 'chat' ? '대화' : '구매요청'}</TabButton>)}
    </div>
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매 편집 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="flex min-h-0 flex-1 flex-col bg-white" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <div className="flex shrink-0 justify-end border-b border-gray-100 px-4 py-2 sm:px-6">
        <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => { setPurchasesOpened(true); setDialogOpen(true) }}>끼룩이</Button>
      </div>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {purchasesOpened && <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {handlesFinance && <div className="flex flex-wrap gap-2" role="group" aria-label="구매요청 보기">
          <Button variant="outline" size="sm" className={pressed} aria-pressed={!viewingFinance} onClick={() => setPurchaseView('own')}>내 요청 보기</Button>
          <Button variant="outline" size="sm" className={pressed} aria-pressed={viewingFinance} onClick={() => { setFinanceOpened(true); setPurchaseView('finance') }}>재정부 제출 요청 보기</Button>
        </div>}
        <div hidden={viewingFinance}>
          <Purchases organizationId={event.organizationId} eventId={event.id} dialogOpen={dialogOpen}
            onDialogClose={() => setDialogOpen(false)} onDetailOpen={() => { setTab('purchases'); setPurchaseView('own') }} onLeaveRiskChange={setOwnRisk}
            onReturnToChat={() => { setTab('chat'); document.getElementById(`${prefix}-chat-tab`)?.focus() }} />
        </div>
        {handlesFinance && <div hidden={!viewingFinance}>
          {financeOpened && <Purchases organizationId={event.organizationId} eventId={event.id} finance onLeaveRiskChange={setFinanceRisk}
            onReturnToChat={() => { setTab('chat'); document.getElementById(`${prefix}-chat-tab`)?.focus() }} />}</div>}
      </div>}
    </div>
  </>
}
