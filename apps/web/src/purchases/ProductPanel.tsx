import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CoupangLink, PurchaseCandidate } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { candidateName, candidatePrice, lookupFailedText, lookupPendingText, won } from './purchase-view'
import type { Candidates } from './useCandidates'

type Props = { link: CoupangLink | null; candidates: Candidates; onClose: () => void }

// 대화의 쿠팡 링크를 누르면 오른쪽에 상품 정보를 연다. 대화는 뒤에 그대로 남는다(2026-10-09 결정).
export default function ProductPanel({ link, candidates, onClose }: Props) {
  const found = link ? candidates.candidates?.find(candidate => candidate.productId === link.productId
    && candidate.vendorItemId === link.vendorItemId) : undefined
  return <Sheet open={link !== null} onOpenChange={open => { if (!open) onClose() }}>
    {link && <SheetContent side="right" title={found?.product?.name ?? '상품 정보'} closeLabel="패널 닫기" className="w-96">
      <PanelBody key={link.url} link={link} found={found} candidates={candidates} />
    </SheetContent>}
  </Sheet>
}

// 링크를 열 때마다 새로 그린다. 연 뒤 받은 후보 목록에도 없으면 후보가 아닌 링크다(0014 전에 올라온 링크, 최근 300개 밖).
function PanelBody({ link, found, candidates }: { link: CoupangLink; found: PurchaseCandidate | undefined; candidates: Candidates }) {
  const [loadsAtOpen] = useState(candidates.loads)
  const missing = !found && (candidates.loadError || candidates.loads > loadsAtOpen)
  const product = found?.product ?? null
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6 pt-14">
    {product?.imageUrl && <img src={product.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-md border object-contain" />}
    <h2 className="text-base font-semibold wrap-anywhere text-gray-900">{found ? candidateName(found) : missing ? lookupFailedText : lookupPendingText}</h2>
    {found && product && <div className="flex flex-col gap-1 text-sm text-gray-700">
      <p>{candidatePrice(found)}</p>
      {product.listPrice !== null && product.discountPercent !== null
        && <p className="text-xs text-gray-500">정가 {won(product.listPrice)} · {product.discountPercent}% 할인</p>}
      {product.deliveryEta && <p className="wrap-anywhere">도착 예정: {product.deliveryEta}</p>}
    </div>}
    {found && <div className="flex flex-wrap gap-1.5">
      {found.lookup === 'ready' && !found.optionKnown && <Badge tone="warning">옵션 미정</Badge>}
      {product?.inStock === false && <Badge tone="danger">품절</Badge>}
    </div>}
    {found?.warning && <p className="text-xs wrap-anywhere text-yellow-700">{found.warning}</p>}
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
      쿠팡에서 보기<ExternalLink /></a>
  </div>
}
