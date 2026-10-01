import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import Purchases from '../purchases/Purchases'

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
  return <>
    <header className="workspace-header"><p className="eyebrow">행사 작업 공간</p><h1>{event.name}</h1></header>
    <div className="workspace-tabs" role="tablist" aria-label="행사 작업">
      {(['chat', 'purchases'] as const).map(value => <button key={value} id={`${prefix}-${value}-tab`} role="tab"
        aria-selected={tab === value} aria-controls={`${prefix}-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={navigate}>{value === 'chat' ? '대화' : '구매요청'}</button>)}
    </div>
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매 편집 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="workspace-panel chat-workspace" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} />
      <button className="ai-launcher" aria-haspopup="dialog" onClick={() => { setPurchasesOpened(true); setDialogOpen(true) }}>끼룩이</button>
    </div>
    <div className="workspace-panel purchases-workspace" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {purchasesOpened && <>
        {handlesFinance && <div className="purchase-views" role="group" aria-label="구매요청 보기">
          <button className="button-secondary" aria-pressed={!viewingFinance} onClick={() => setPurchaseView('own')}>내 요청 보기</button>
          <button className="button-secondary" aria-pressed={viewingFinance} onClick={() => { setFinanceOpened(true); setPurchaseView('finance') }}>재정부 제출 요청 보기</button>
        </div>}
        <div hidden={viewingFinance}>
        <Purchases organizationId={event.organizationId} eventId={event.id} dialogOpen={dialogOpen}
          onDialogClose={() => setDialogOpen(false)} onDetailOpen={() => { setTab('purchases'); setPurchaseView('own') }} onLeaveRiskChange={setOwnRisk}
          onReturnToChat={() => { setTab('chat'); document.getElementById(`${prefix}-chat-tab`)?.focus() }} />
        </div>
        {handlesFinance && <div hidden={!viewingFinance}>
          {financeOpened && <Purchases organizationId={event.organizationId} eventId={event.id} finance onLeaveRiskChange={setFinanceRisk}
            onReturnToChat={() => { setTab('chat'); document.getElementById(`${prefix}-chat-tab`)?.focus() }} />}</div>}
      </>}
    </div>
  </>
}
