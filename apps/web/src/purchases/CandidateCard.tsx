import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PurchaseCandidate } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { candidateName, candidatePrice, hiddenText, requestText, shareText } from './purchase-view'

type Props = {
  candidate: PurchaseCandidate
  selection?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }
  // 공유 표시를 누르면 대화의 그 메시지로 간다.
  onShowMessage: (messageId: string) => void
  children?: ReactNode
}

// 후보 하나. 상품 정보는 뒤에서 조회한 값이다. 1차 품목 카드와 같은 모양을 쓴다.
export default function CandidateCard({ candidate, selection, onShowMessage, children }: Props) {
  const name = candidateName(candidate)
  const [first] = candidate.shares
  const ready = candidate.lookup === 'ready' && candidate.product !== null
  const linkClass = 'h-auto justify-start p-0 text-left text-xs whitespace-normal wrap-anywhere'
  return <li className={cn(cardClass, 'flex gap-3 p-4')}>
    {selection && <input type="checkbox" className="mt-1 size-4 shrink-0 accent-blue-600" aria-label={`${name} 고르기`}
      checked={selection.checked} disabled={selection.disabled} onChange={event => selection.onChange(event.target.checked)} />}
    {candidate.product?.imageUrl && <img src={candidate.product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
      className="size-16 shrink-0 rounded-md border object-cover" />}
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">{name}</p>
        <a href={candidate.url} target="_blank" rel="noopener noreferrer" aria-label="쿠팡에서 보기"
          className={buttonVariants({ variant: 'ghost', size: 'icon', className: '-my-1.5' })}><ExternalLink /></a>
      </div>
      {ready ? <p className="text-xs text-gray-700">{candidatePrice(candidate)}</p>
        : <p className="text-xs wrap-anywhere text-gray-500">{candidate.url}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {candidate.lookup === 'ready' && !candidate.optionKnown && <Badge tone="warning">옵션 미정</Badge>}
        {candidate.product?.inStock === false && <Badge tone="danger">품절</Badge>}
        {candidate.requests.map((request, index) => <Badge key={index} tone="info" className="whitespace-normal wrap-anywhere">{requestText(request)}</Badge>)}
        {candidate.draftedByMe && <Badge>내가 담음</Badge>}
      </div>
      {candidate.warning && <p className="text-xs wrap-anywhere text-yellow-700">{candidate.warning}</p>}
      {first && <Button variant="link" size="sm" className={cn(linkClass, 'self-start')} onClick={() => onShowMessage(first.messageId)}>
        {shareText(first)}{candidate.shareCount > 1 ? ` · 외 ${candidate.shareCount - 1}번` : ''}</Button>}
      {candidate.shares.length > 1 && <details className="text-xs text-gray-600">
        <summary className="cursor-pointer">공유 {candidate.shareCount}번</summary>
        <ul className="mt-1 flex flex-col gap-1">{candidate.shares.map((share, index) => <li key={index}>
          <Button variant="link" size="sm" className={linkClass} onClick={() => onShowMessage(share.messageId)}>{shareText(share)}</Button>
        </li>)}</ul>
      </details>}
      {candidate.hidden && <p className="text-xs wrap-anywhere text-gray-500">{hiddenText(candidate.hidden)}</p>}
      {children && <div className="flex flex-wrap justify-end gap-2">{children}</div>}
    </div>
  </li>
}
