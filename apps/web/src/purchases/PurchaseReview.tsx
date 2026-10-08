import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { DecidePurchaseItemsSchema, type PurchaseItemSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import ShipmentForm from '../deliveries/ShipmentForm'
import { useDeliveries } from '../deliveries/useDeliveries'
import ItemDetailDialog from './ItemDetailDialog'
import PurchaseItemCard, { productNameOf } from './PurchaseItemCard'
import { groupBySubmission, pressed, priceNotice, timeText, totalOf, won } from './purchase-view'
import { fetchItemDetail, type PurchaseResult } from './useEventPurchases'
import type { PurchaseReview as State } from './usePurchaseReview'

type Props = { organizationId: string; state: State }

// 재정부 화면. 모든 행사의 대기 품목을 같이 제출한 묶음으로 보여 주고, 승인한 품목을 사고 송장을 연결한다.
export default function PurchaseReview({ organizationId, state }: Props) {
  const [view, setView] = useState<'review' | 'buy'>('review')
  const [message, setMessage] = useState('')
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null)
  const [opened, setOpened] = useState<PurchaseItemSummary | null>(null)
  const [shipping, setShipping] = useState(false)
  const [unlinking, setUnlinking] = useState<{ shipmentId: string; linkId: string } | null>(null)
  const deliveries = useDeliveries(organizationId, true)
  if (!state.data) return <div className="p-4 sm:p-6">{state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">구매 검토를 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">구매 검토 불러오는 중…</StateMessage>}</div>
  const { pending, approved, truncated } = state.data
  const toBuy = approved.filter(item => !item.purchasedAt)
  const bought = approved.filter(item => item.purchasedAt)
  async function run(action: () => Promise<PurchaseResult>) {
    setMessage('')
    const result = await action()
    if (!result.ok) setMessage(result.message)
    return result.ok
  }
  const flags = (item: PurchaseItemSummary, withEvent: boolean) => <>
    {withEvent && <Badge className="whitespace-normal wrap-anywhere">{item.event.name}</Badge>}
    {item.mine && <Badge tone="warning">내 품목</Badge>}
    {item.status === 'approved' && item.decidedBy?.id === item.requester.id && <Badge tone="warning">본인 승인</Badge>}
    {item.neededByChanged && <Badge tone="warning">날짜 바뀜</Badge>}
  </>
  function rejectForm(item: PurchaseItemSummary) {
    const reason = rejecting?.reason ?? ''
    const valid = DecidePurchaseItemsSchema.safeParse({ decisions: [{ id: item.id, version: item.version, decision: 'rejected', reason }] }).success
    return <div className="flex w-full flex-col gap-2">
      <Label className="flex flex-col gap-1.5">반려 사유
        <Textarea value={reason} rows={2} placeholder="요청자가 보고 고칠 수 있게 적어 주세요."
          onChange={event => setRejecting({ id: item.id, reason: event.target.value })} /></Label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={state.busy} onClick={() => setRejecting(null)}>취소</Button>
        <Button variant="destructive" size="sm" disabled={state.busy || !valid}
          onClick={() => void run(() => state.reject(item, reason)).then(done => { if (done) setRejecting(null) })}>반려하기</Button>
      </div>
    </div>
  }
  const reviewView = pending.length === 0
    ? <Card><EmptyState icon={ClipboardCheck} title="검토할 품목이 없어요" /></Card>
    : groupBySubmission(pending).map(group => {
      const total = totalOf(group.items)
      return <section key={group.id} aria-label={`${group.requester.name}의 제출`} className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold wrap-anywhere text-gray-900">{group.requester.name} · {group.departmentName ?? '미배정'} · {group.event.name}</h3>
          <span className="text-xs text-gray-500">{timeText(group.submittedAt)}</span>
        </div>
        <p className="text-xs text-gray-700">합계 {won(total.known)}{total.complete ? '' : ' · 일부 금액 확인 필요'}</p>
        <ul className="flex flex-col gap-3">{group.items.map(item => <PurchaseItemCard key={item.id} item={item} plain badges={flags(item, false)} onOpen={() => setOpened(item)}>
          {rejecting?.id === item.id ? rejectForm(item) : <>
            <Button variant="outline" size="sm" disabled={state.busy} onClick={() => setRejecting({ id: item.id, reason: '' })}>반려</Button>
            <Button size="sm" disabled={state.busy} onClick={() => void run(() => state.approve([item]))}>승인</Button>
          </>}
        </PurchaseItemCard>)}</ul>
        {group.items.length > 1 && <Button size="sm" className="self-end" disabled={state.busy} onClick={() => void run(() => state.approve(group.items))}>모두 승인</Button>}
      </section>
    })
  const buyView = <>
    <section aria-label="살 품목" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">살 품목 {toBuy.length}</h3>
      {toBuy.length === 0 ? <p className="text-sm text-gray-500">살 품목이 없어요</p>
        : <ul className="flex flex-col gap-2">{toBuy.map(item => <PurchaseItemCard key={item.id} item={item} showRequester badges={flags(item, true)} onOpen={() => setOpened(item)}>
          <Button variant="outline" size="sm" disabled={state.busy} onClick={() => void run(() => state.revoke(item))}>승인 취소</Button>
          <Button size="sm" disabled={state.busy} onClick={() => void run(() => state.setPurchased(item, true))}>샀어요</Button>
        </PurchaseItemCard>)}</ul>}
    </section>
    <section aria-label="산 품목" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">산 품목 {bought.length}</h3>
        {deliveries.available && bought.length > 0 && <Button variant="outline" size="sm" disabled={state.busy || deliveries.busy}
          onClick={() => setShipping(true)}>송장 등록</Button>}
      </div>
      {deliveries.notice && <StateMessage kind="notice">{deliveries.notice}</StateMessage>}
      {deliveries.error && !shipping && <StateMessage kind="error">{deliveries.error}</StateMessage>}
      {bought.length === 0 ? <p className="text-sm text-gray-500">산 품목이 없어요</p>
        : <ul className="flex flex-col gap-2">{bought.map(item => <PurchaseItemCard key={item.id} item={item} showRequester badges={flags(item, true)} onOpen={() => setOpened(item)}>
          {deliveries.available && item.shipments.map(shipment => <Button key={shipment.linkId} variant="ghost" size="sm" disabled={deliveries.busy}
            onClick={() => setUnlinking({ shipmentId: shipment.id, linkId: shipment.linkId })}>연결 해제</Button>)}
          {item.shipments.length === 0 && <Button variant="outline" size="sm" disabled={state.busy}
            onClick={() => void run(() => state.setPurchased(item, false))}>구매 표시 취소</Button>}
        </PurchaseItemCard>)}</ul>}
    </section>
  </>
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div role="group" aria-label="구매 검토 보기" className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'review'} onClick={() => setView('review')}>검토할 품목 {pending.length}</Button>
        <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'buy'} onClick={() => setView('buy')}>구매·배송 {approved.length}</Button>
      </div>
      {message && <StateMessage kind="error">{message}</StateMessage>}
      {truncated && <StateMessage kind="notice">앞의 300개만 보여요. 처리하면 다음 품목이 보여요.</StateMessage>}
      {(pending.length > 0 || approved.length > 0) && <p className="text-xs text-gray-500">{priceNotice}</p>}
      {view === 'review' ? reviewView : buyView}
    </div>
    <ItemDetailDialog itemId={opened?.id ?? null} onClose={() => setOpened(null)}
      load={id => fetchItemDetail(organizationId, opened?.event.id ?? '', id)} />
    <Dialog open={unlinking !== null} onOpenChange={open => { if (!open && !deliveries.busy) setUnlinking(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>이 송장 연결을 해제할까요?</DialogTitle><DialogDescription>해제한 뒤 올바른 송장을 다시 등록할 수 있어요.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={deliveries.busy} onClick={() => setUnlinking(null)}>취소</Button>
          <Button variant="destructive" disabled={deliveries.busy} onClick={() => {
            if (unlinking) void deliveries.unlink(unlinking.shipmentId, unlinking.linkId).then(done => { setUnlinking(null); if (done) state.refresh() })
          }}>연결 해제</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={shipping} onOpenChange={open => { if (!deliveries.busy) setShipping(open) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>송장 등록</DialogTitle><DialogDescription>고른 품목에 송장을 연결해요.</DialogDescription></DialogHeader>
        {deliveries.error && <StateMessage kind="error">{deliveries.error}</StateMessage>}
        <ShipmentForm busy={deliveries.busy} carriers={deliveries.carriers} onSearchCarriers={deliveries.searchCarriers}
          items={bought.map(item => ({ id: item.id, name: `${productNameOf(item)} · ${item.event.name}`, shipped: item.shipments.length > 0 }))}
          onLookup={deliveries.lookup} onRegister={async (input, itemIds) => {
            const done = await deliveries.register(input, itemIds)
            if (done) { setShipping(false); state.refresh() }
            return done
          }} />
      </DialogContent>
    </Dialog>
  </div>
}
