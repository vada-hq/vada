import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import EventPurchases from '../purchases/EventPurchases'
import LinkDialog from '../purchases/LinkDialog'
import { useEventPurchases } from '../purchases/useEventPurchases'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'

const tabs = { chat: '대화', purchases: '구매' } as const
type Tab = keyof typeof tabs

export default function EventWorkspace({ event, onLeaveRiskChange }: { event: EventSummary; onLeaveRiskChange: (risk: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('chat')
  // 구매 목록은 구매 탭을 처음 열거나 끼룩이를 켤 때 불러온다.
  const [opened, setOpened] = useState(false)
  const purchases = useEventPurchases(event.organizationId, event.id, opened)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [links, setLinks] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const risk = purchases.generating || Boolean(links.trim())
  useEffect(() => { onLeaveRiskChange(risk) }, [risk, onLeaveRiskChange])
  useEffect(() => () => onLeaveRiskChange(false), [onLeaveRiskChange])
  const prefix = useId()
  function select(next: Tab) { setTab(next); if (next === 'purchases') setOpened(true) }
  function navigate(keyboard: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboard.key)) return
    keyboard.preventDefault()
    const next: Tab = keyboard.key === 'Home' ? 'chat' : keyboard.key === 'End' ? 'purchases' : tab === 'chat' ? 'purchases' : 'chat'
    select(next)
    document.getElementById(`${prefix}-${next}-tab`)?.focus()
  }
  function openDialog() { setOpened(true); setDialogError(''); setDialogOpen(true) }
  async function create(urls: string[]) {
    setDialogError('')
    const result = await purchases.create(urls)
    if (!result.ok) { setDialogError(result.message); return }
    setLinks(''); setDialogOpen(false); setTab('purchases')
    setNotice({ id: Date.now(), text: `${result.items.length}개를 담았어요. 확인하고 제출해 주세요.` })
  }
  // 행사 이름은 WorkspaceHeader의 제목이 보여 준다. 대화 탭은 흰 바탕 전체 화면, 구매 탭은 gray-50 본문에 여백을 둔다.
  return <>
    <div className="flex shrink-0 gap-0.5 border-b bg-white px-4 sm:px-6" role="tablist" aria-label="행사 작업">
      {(Object.keys(tabs) as Tab[]).map(value => <TabButton key={value} id={`${prefix}-${value}-tab`}
        aria-selected={tab === value} aria-controls={`${prefix}-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={navigate}>{tabs[value]}</TabButton>)}
    </div>
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매 화면 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="flex min-h-0 flex-1 flex-col bg-white" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <div className="flex shrink-0 justify-end border-b border-gray-100 px-4 py-2 sm:px-6">
        <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={openDialog}>끼룩이</Button>
      </div>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {opened && <div className="mx-auto max-w-3xl"><EventPurchases state={purchases} onCreate={openDialog} notice={notice} /></div>}
    </div>
    <LinkDialog open={dialogOpen} links={links} onLinksChange={setLinks} busy={purchases.generating} disabled={false} error={dialogError}
      onClose={() => { if (!purchases.generating) setDialogOpen(false) }} onCreate={urls => { void create(urls) }} />
  </>
}
