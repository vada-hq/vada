import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PurchaseItemDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { carrierName, deliveryStatusLabels } from '../deliveries/delivery-status'
import { productNameOf } from './PurchaseItemCard'
import { actionText, neededByText, progressOf, timeText, won } from './purchase-view'

type Props = { itemId: string | null; load: (itemId: string) => Promise<PurchaseItemDetail | null>; onClose: () => void }

// 품목을 누르면 근거 대화와 처리 기록을 함께 보여 준다.
export default function ItemDetailDialog({ itemId, load, onClose }: Props) {
  return <Dialog open={itemId !== null} onOpenChange={open => { if (!open) onClose() }}>
    {itemId && <DialogContent><Detail key={itemId} itemId={itemId} load={load} /></DialogContent>}
  </Dialog>
}

function Detail({ itemId, load }: { itemId: string; load: Props['load'] }) {
  const [detail, setDetail] = useState<PurchaseItemDetail | null | undefined>(undefined)
  // 대화상자를 열 때 한 번만 불러온다. 다른 품목은 key로 새로 만든다.
  const loader = useRef(load)
  useEffect(() => {
    let current = true
    void loader.current(itemId).then(value => { if (current) setDetail(value) })
    return () => { current = false }
  }, [itemId])
  if (detail === undefined) return <>
    <DialogHeader><DialogTitle>품목</DialogTitle><DialogDescription>불러오는 중…</DialogDescription></DialogHeader>
    <StateMessage kind="loading">불러오는 중…</StateMessage>
  </>
  if (detail === null) return <>
    <DialogHeader><DialogTitle>품목</DialogTitle><DialogDescription>상세를 볼 수 없어요.</DialogDescription></DialogHeader>
    <StateMessage kind="error">품목을 불러오지 못했어요.</StateMessage>
  </>
  const fields: [string, string][] = [
    ['옵션', detail.selectedOption ?? '확인 필요'], ['포장 단위', detail.packagingUnit ?? '—'],
    ['수량', detail.quantity === null ? '확인 필요' : `${detail.quantity}개`],
    ['예상 단가', detail.estimatedUnitPrice === null ? '확인 필요' : won(detail.estimatedUnitPrice)],
    ['용도', detail.note ?? '—'], ['받을 날짜', neededByText(detail.neededBy)],
    ...(detail.decisionReason ? [['반려 사유', detail.decisionReason] as [string, string]] : []),
  ]
  return <>
    <DialogHeader>
      <DialogTitle className="wrap-anywhere">{productNameOf(detail)}</DialogTitle>
      <DialogDescription className="wrap-anywhere">{progressOf(detail).label} · {detail.requester.name}{detail.departmentName ? ` · ${detail.departmentName}` : ''}</DialogDescription>
    </DialogHeader>
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">{fields.map(([label, value]) => <div key={label} className="contents">
      <dt className="text-gray-500">{label}</dt><dd className="col-span-2 wrap-anywhere text-gray-900">{value}</dd></div>)}</dl>
    <a href={detail.productUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'self-start' })}>
      <ExternalLink />쿠팡에서 보기</a>
    <section aria-label="근거 대화" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">근거 대화</h3>
      {detail.sources.length ? detail.sources.map(source => <blockquote key={source.id}
        className="border-l-4 border-gray-200 pl-3 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700">
        <span className="block text-xs text-gray-500">{source.authorName} · {timeText(source.createdAt)}</span>{source.content}</blockquote>)
        : <p className="text-sm text-gray-500">연결된 근거 대화가 없어요.</p>}
    </section>
    <section aria-label="처리 기록" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">처리 기록</h3>
      {detail.history.length ? <ol className="flex flex-col gap-1 text-sm">{detail.history.map(entry => <li key={entry.id} className="wrap-anywhere">
        <span className="font-medium">{actionText(entry, detail.requester.id)}</span> · {entry.actor.name} · {timeText(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ''}
      </li>)}</ol> : <p className="text-sm text-gray-500">아직 처리 기록이 없어요.</p>}
    </section>
    {detail.shipments.length > 0 && <section aria-label="배송" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">배송</h3>
      <ul className="flex flex-col gap-1 text-sm">{detail.shipments.map(shipment => <li key={shipment.linkId} className="wrap-anywhere">
        {deliveryStatusLabels[shipment.status]} · {carrierName(shipment.carrierId)} · {shipment.trackingNumber}</li>)}</ul>
    </section>}
  </>
}
