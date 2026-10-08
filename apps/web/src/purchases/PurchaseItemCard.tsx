import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PurchaseItemSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { carrierName } from '../deliveries/delivery-status'
import { amountOf, missingFields, neededByText, progressOf, won } from './purchase-view'

export const productNameOf = (item: Pick<PurchaseItemSummary, 'productName'>) => item.productName ?? '상품명 확인 필요'

type Props = {
  item: PurchaseItemSummary
  // 행사 전체와 구매 검토에서는 누가 요청했는지 보여 준다.
  showRequester?: boolean
  selection?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }
  badges?: ReactNode
  // 구매 검토 묶음 안에서는 카드 테두리 없이 줄로 보여 준다.
  plain?: boolean
  onOpen: () => void
  children?: ReactNode
}

// 내 품목·행사 전체·구매 검토가 같은 카드를 쓴다. 버튼은 쓰는 쪽이 children으로 넣는다.
export default function PurchaseItemCard({ item, showRequester = false, selection, badges, plain = false, onOpen, children }: Props) {
  const name = productNameOf(item)
  const progress = progressOf(item)
  const amount = amountOf(item)
  const missing = item.status === 'draft' ? missingFields(item) : []
  const details = [item.selectedOption, item.packagingUnit, item.quantity === null ? '수량 확인 필요' : `${item.quantity}개`,
    amount === null ? '금액 확인 필요' : `예상 ${won(amount)}`].filter(Boolean).join(' · ')
  return <li className={cn('flex gap-3', plain ? 'border-t pt-3 first:border-t-0 first:pt-0' : cn(cardClass, 'p-4'))}>
    {selection && <input type="checkbox" className="mt-1 size-4 shrink-0 accent-blue-600" aria-label={`${name} 고르기`}
      checked={selection.checked} disabled={selection.disabled} onChange={event => selection.onChange(event.target.checked)} />}
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-start gap-1">
        <Button variant="ghost" onClick={onOpen} className="h-auto min-w-0 flex-1 shrink justify-start p-0 text-left text-sm font-medium whitespace-normal wrap-anywhere text-gray-900 hover:bg-transparent hover:underline">{name}</Button>
        <a href={item.productUrl} target="_blank" rel="noopener noreferrer" aria-label="쿠팡에서 보기"
          className={buttonVariants({ variant: 'ghost', size: 'icon', className: '-my-1.5' })}><ExternalLink /></a>
      </div>
      <p className="text-xs wrap-anywhere text-gray-500">{details}</p>
      {showRequester && <p className="text-xs wrap-anywhere text-gray-500">{item.requester.name}{item.departmentName ? ` · ${item.departmentName}` : ''}</p>}
      <p className="text-xs wrap-anywhere text-gray-700">{item.note ? `용도: ${item.note} · ` : ''}받을 날짜: {neededByText(item.neededBy)}</p>
      <div className="flex flex-wrap items-center gap-1.5"><Badge tone={progress.tone}>{progress.label}</Badge>{badges}</div>
      {item.status === 'rejected' && item.decisionReason && <p className="text-xs wrap-anywhere text-red-700">반려 사유: {item.decisionReason}</p>}
      {missing.length > 0 && <p className="text-xs text-yellow-700">제출 전 확인: {missing.join(', ')}</p>}
      {item.status === 'draft' && item.warnings.length > 0 && <details className="text-xs text-gray-600">
        <summary className="cursor-pointer">확인할 점 {item.warnings.length}</summary>
        <ul className="mt-1 list-disc pl-5 wrap-anywhere">{item.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      </details>}
      {item.shipments.length > 0 && <ul className="flex flex-col gap-0.5 text-xs text-gray-500">{item.shipments.map(shipment =>
        <li key={shipment.linkId} className="wrap-anywhere">{carrierName(shipment.carrierId)} · {shipment.trackingNumber}</li>)}</ul>}
      {children && <div className="flex flex-wrap justify-end gap-2">{children}</div>}
    </div>
  </li>
}
