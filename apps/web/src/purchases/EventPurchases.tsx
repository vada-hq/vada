import { useState, type ReactNode } from 'react'
import { ShoppingCart } from 'lucide-react'
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
import PurchaseCandidates from './PurchaseCandidates'
import PurchaseItemCard, { productNameOf } from './PurchaseItemCard'
import { missingFields, pressed, priceNotice, sectionOf, todayInSeoul, won } from './purchase-view'
import type { Candidates } from './useCandidates'
import type { EventPurchases as State, PurchaseResult } from './useEventPurchases'

export type PurchaseView = 'candidates' | 'mine' | 'all'
const views: { value: PurchaseView; label: string }[] = [
  { value: 'candidates', label: '후보' }, { value: 'mine', label: '내 품목' }, { value: 'all', label: '행사 전체' }]
type PriceChange = { name: string; from: number | null; to: number }
type Props = {
  state: State
  candidates: Candidates
  view: PurchaseView
  onViewChange: (view: PurchaseView) => void
  // 후보의 공유 표시를 누르면 대화의 그 메시지로 간다.
  onShowMessage: (messageId: string) => void
}

// 행사의 구매 탭. 후보에서 골라 담고, 내 품목은 작성 중·진행 중·끝남으로, 행사 전체는 제출된 품목을 진행 중·끝남으로 나눈다.
export default function EventPurchases({ state, candidates, view, onViewChange, onShowMessage }: Props) {
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([])
  const [dialogError, setDialogError] = useState('')
  const [editing, setEditing] = useState<PurchaseItemSummary | null>(null)
  const [dating, setDating] = useState<PurchaseItemSummary[] | null>(null)
  const [removing, setRemoving] = useState<PurchaseItemSummary | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  function clear() { setMessage(''); setNotice(''); setPriceChanges([]) }
  // 후보에서 담으면 내 품목으로 가서 새 품목을 골라 둔 채 보여 준다.
  async function add(ids: string[]) {
    const result = await state.create(ids)
    if (result.ok) {
      clear()
      setNotice(`${result.items.length}개를 담았어요. 확인하고 제출해 주세요.`)
      onViewChange('mine')
      candidates.refresh()
    }
    return result
  }
  const switcher = <div role="group" aria-label="구매 보기" className="flex flex-wrap gap-2">
    {views.map(option => <Button key={option.value} variant="outline" size="sm" className={pressed} aria-pressed={view === option.value}
      onClick={() => onViewChange(option.value)}>{option.label}</Button>)}
  </div>
  if (view === 'candidates') return <div className="flex flex-col gap-4">{switcher}
    <PurchaseCandidates candidates={candidates} generating={state.generating} onAdd={add} onShowMessage={onShowMessage} /></div>
  if (!state.items) return <div className="flex flex-col gap-4">{switcher}{state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">구매 품목을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">구매 품목 불러오는 중…</StateMessage>}</div>
  const items = state.items
  const mine = items.filter(item => item.mine)
  const drafts = mine.filter(item => sectionOf(item) === 'draft')
  const chosen = drafts.filter(item => state.selected.includes(item.id))
  const blocked = chosen.some(item => missingFields(item).length > 0)
  const shared = items.filter(item => item.status !== 'draft')

  async function run(action: () => Promise<PurchaseResult>) {
    clear()
    const result = await action()
    if (!result.ok) setMessage(result.message)
  }
  // 제출할 때 하루 지난 가격을 서버가 다시 조회한다. 바뀐 품목을 알린다.
  async function submit() {
    clear()
    const before = new Map(chosen.map(item => [item.id, item.estimatedUnitPrice]))
    const result = await state.submit(chosen)
    if (!result.ok) { setMessage(result.message); return }
    setPriceChanges(result.items.flatMap(item => {
      const from = before.get(item.id)
      return from !== undefined && item.estimatedUnitPrice !== null && from !== item.estimatedUnitPrice
        ? [{ name: productNameOf(item), from, to: item.estimatedUnitPrice }] : []
    }))
  }
  // 대화상자 안의 실패는 대화상자에 보여 준다. 성공하면 닫는다.
  // 먼저 바뀐 품목이면 대화상자가 든 품목이 오래된 것이다. 닫고 위쪽에 안내해 새로 불러온 목록에서 다시 열게 한다.
  async function inDialog(action: () => Promise<PurchaseResult>, close: () => void) {
    setDialogError('')
    clear()
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
      <Button size="sm" disabled={state.busy || chosen.length === 0 || blocked} onClick={() => void submit()}>선택한 {chosen.length}개 제출</Button>
      <Button variant="outline" size="sm" disabled={state.busy || chosen.length === 0} onClick={() => openDialog(() => setDating(chosen))}>받을 날짜 바꾸기</Button>
    </div>
    {blocked && <p className="text-xs text-yellow-700">제출 전에 채울 칸이 있는 품목이 있어요.</p>}
    <p className="text-xs text-gray-500">{priceNotice}</p>
  </div>

  return <div className="flex flex-col gap-4">
    {switcher}
    {notice && <StateMessage kind="notice">{notice}</StateMessage>}
    {priceChanges.length > 0 && <div className="flex flex-col gap-1" role="status">
      <p className="text-sm text-gray-500">가격이 바뀐 품목이 있어 새 가격으로 제출했어요.</p>
      <ul className="flex flex-col gap-0.5 text-xs text-gray-700">
        {priceChanges.slice(0, 3).map((change, index) => <li key={index} className="wrap-anywhere">
          {change.name} {change.from === null ? '금액 확인 필요' : won(change.from)} → {won(change.to)}</li>)}
        {priceChanges.length > 3 && <li>외 {priceChanges.length - 3}개</li>}
      </ul>
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {state.truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
    {view === 'mine' ? <>
      {section('작성 중', drafts, false, draftTools)}
      {section('진행 중', mine.filter(item => sectionOf(item) === 'active'), false)}
      {section('끝남', mine.filter(item => sectionOf(item) === 'ended'), false)}
      {mine.length === 0 && <Card><EmptyState icon={ShoppingCart} title="아직 담은 품목이 없어요" description="후보에서 골라 담아 보세요." /></Card>}
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
