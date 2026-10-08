import { useState, type ReactNode } from 'react'
import { ShoppingCart, Sparkles } from 'lucide-react'
import type { PurchaseItemSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import DraftEditDialog from './DraftEditDialog'
import ItemDetailDialog from './ItemDetailDialog'
import NeededByDialog from './NeededByDialog'
import PurchaseItemCard from './PurchaseItemCard'
import { missingFields, pressed, priceNotice, sectionOf, todayInSeoul } from './purchase-view'
import type { EventPurchases as State, PurchaseResult } from './useEventPurchases'

type Props = { state: State; onCreate: () => void; notice?: { id: number; text: string } | null }

// 행사의 구매 탭. 내 품목은 작성 중·진행 중·끝남으로, 행사 전체는 제출된 품목을 진행 중·끝남으로 나눈다.
export default function EventPurchases({ state, onCreate, notice = null }: Props) {
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [message, setMessage] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [editing, setEditing] = useState<PurchaseItemSummary | null>(null)
  const [dating, setDating] = useState<PurchaseItemSummary[] | null>(null)
  const [removing, setRemoving] = useState<PurchaseItemSummary | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  // 담기 안내는 다음 동작을 하면 지운다.
  const [seenNotice, setSeenNotice] = useState<number | null>(null)
  if (!state.items) return state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">구매 품목을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">구매 품목 불러오는 중…</StateMessage>
  const items = state.items
  const mine = items.filter(item => item.mine)
  const drafts = mine.filter(item => sectionOf(item) === 'draft')
  const chosen = drafts.filter(item => state.selected.includes(item.id))
  const blocked = chosen.some(item => missingFields(item).length > 0)
  const shared = items.filter(item => item.status !== 'draft')

  async function run(action: () => Promise<PurchaseResult>) {
    setMessage('')
    if (notice) setSeenNotice(notice.id)
    const result = await action()
    if (!result.ok) setMessage(result.message)
  }
  // 대화상자 안의 실패는 대화상자에 보여 준다. 성공하면 닫는다.
  // 먼저 바뀐 품목이면 대화상자가 든 품목이 오래된 것이다. 닫고 위쪽에 안내해 새로 불러온 목록에서 다시 열게 한다.
  async function inDialog(action: () => Promise<PurchaseResult>, close: () => void) {
    setDialogError('')
    setMessage('')
    if (notice) setSeenNotice(notice.id)
    const result = await action()
    if (result.ok) close()
    else if (result.stale) { close(); setMessage(result.message) }
    else setDialogError(result.message)
  }
  function openDialog(open: () => void) { setDialogError(''); open() }
  function choose(item: PurchaseItemSummary, checked: boolean) {
    state.setSelected(checked ? [...state.selected, item.id] : state.selected.filter(id => id !== item.id))
  }

  const actionsOf = (item: PurchaseItemSummary): ReactNode => {
    const disabled = state.busy
    if (item.status === 'draft') return <>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => openDialog(() => setRemoving(item))}>지우기</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => openDialog(() => setEditing(item))}>수정</Button>
    </>
    if (item.status === 'rejected' || item.status === 'cancelled') return item.mine
      ? <Button variant="outline" size="sm" disabled={disabled} onClick={() => void run(() => state.reAdd(item))}>다시 담기</Button> : null
    const canDate = item.mine && !item.purchasedAt && (item.status === 'pending' || item.status === 'approved')
    return <>
      {canDate && <Button variant="ghost" size="sm" disabled={disabled} onClick={() => openDialog(() => setDating([item]))}>날짜</Button>}
      {item.mine && item.status === 'pending' && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void run(() => state.cancel(item))}>요청 취소</Button>}
      {item.status === 'approved' && item.purchasedAt && !item.receivedAt && <Button size="sm" disabled={disabled}
        onClick={() => void run(() => state.setReceived(item, true))}>받았어요</Button>}
      {item.status === 'approved' && item.receivedAt && <Button variant="ghost" size="sm" disabled={disabled}
        onClick={() => void run(() => state.setReceived(item, false))}>수령 취소</Button>}
    </>
  }
  const card = (item: PurchaseItemSummary, showRequester: boolean) => <PurchaseItemCard key={item.id} item={item} showRequester={showRequester}
    onOpen={() => setOpened(item.id)} selection={item.status === 'draft' && item.mine
      ? { checked: state.selected.includes(item.id), disabled: state.busy, onChange: checked => choose(item, checked) } : undefined}>
    {actionsOf(item)}
  </PurchaseItemCard>
  const section = (title: string, list: PurchaseItemSummary[], showRequester: boolean, extra?: ReactNode) => list.length > 0 &&
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">{title} {list.length}</h3>
      {extra}
      <ul className="flex flex-col gap-2">{list.map(item => card(item, showRequester))}</ul>
    </section>
  const allChosen = drafts.length > 0 && drafts.every(item => state.selected.includes(item.id))
  const draftTools = <div className="flex flex-col gap-2">
    <Label className="flex items-center gap-2 font-normal">
      <input type="checkbox" className="size-4 accent-blue-600" checked={allChosen} disabled={state.busy}
        onChange={event => state.setSelected(event.target.checked ? drafts.map(item => item.id) : [])} />모두 선택</Label>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={state.busy || chosen.length === 0 || blocked} onClick={() => void run(() => state.submit(chosen))}>선택한 {chosen.length}개 제출</Button>
      <Button variant="outline" size="sm" disabled={state.busy || chosen.length === 0} onClick={() => openDialog(() => setDating(chosen))}>받을 날짜 바꾸기</Button>
    </div>
    {blocked && <p className="text-xs text-yellow-700">제출 전에 채울 칸이 있는 품목이 있어요.</p>}
    <p className="text-xs text-gray-500">{priceNotice}</p>
  </div>

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="구매 보기" className="flex gap-2">
        <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'mine'} onClick={() => setView('mine')}>내 품목</Button>
        <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'all'} onClick={() => setView('all')}>행사 전체</Button>
      </div>
      <Button size="sm" disabled={state.generating} onClick={onCreate}><Sparkles />끼룩이로 담기</Button>
    </div>
    {notice && notice.id !== seenNotice && <StateMessage kind="notice">{notice.text}</StateMessage>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {state.truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
    {view === 'mine' ? <>
      {section('작성 중', drafts, false, draftTools)}
      {section('진행 중', mine.filter(item => sectionOf(item) === 'active'), false)}
      {section('끝남', mine.filter(item => sectionOf(item) === 'ended'), false)}
      {mine.length === 0 && <Card><EmptyState icon={ShoppingCart} title="아직 담은 품목이 없어요" description="대화에서 정한 쿠팡 링크를 끼룩이로 담아 보세요." /></Card>}
    </> : <>
      {section('진행 중', shared.filter(item => sectionOf(item) === 'active'), true)}
      {section('끝남', shared.filter(item => sectionOf(item) === 'ended'), true)}
      {shared.length === 0 && <Card><EmptyState icon={ShoppingCart} title="아직 제출된 품목이 없어요" /></Card>}
    </>}
    <DraftEditDialog item={editing} busy={state.busy} error={dialogError} onClose={() => setEditing(null)}
      onSave={(item, fields) => void inDialog(() => state.update(item, fields), () => setEditing(null))} />
    <NeededByDialog items={dating} today={todayInSeoul()} busy={state.busy} error={dialogError} onClose={() => setDating(null)}
      onSave={(targets, neededBy) => void inDialog(() => state.changeNeededBy(targets, neededBy), () => setDating(null))} />
    <Dialog open={removing !== null} onOpenChange={open => { if (!open && !state.busy) setRemoving(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>작성 중 품목을 지울까요?</DialogTitle><DialogDescription>지운 품목은 되돌릴 수 없어요.</DialogDescription></DialogHeader>
        {dialogError && <StateMessage kind="error">{dialogError}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={state.busy} onClick={() => setRemoving(null)}>취소</Button>
          <Button variant="destructive" disabled={state.busy}
            onClick={() => { if (removing) void inDialog(() => state.remove(removing), () => setRemoving(null)) }}>지우기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ItemDetailDialog itemId={opened} load={state.detail} onClose={() => setOpened(null)} />
  </div>
}
