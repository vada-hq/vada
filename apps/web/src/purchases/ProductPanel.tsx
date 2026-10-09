import { ExternalLink } from 'lucide-react'
import type { CoupangLink } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { candidateName, candidatePrice, won } from './purchase-view'
import type { Candidates } from './useCandidates'

type Props = { link: CoupangLink | null; candidates: Candidates; onClose: () => void }

// 대화의 쿠팡 링크를 누르면 오른쪽에 상품 정보를 연다. 대화는 뒤에 그대로 남는다(2026-10-09 결정).
export default function ProductPanel({ link, candidates, onClose }: Props) {
  const found = link ? candidates.candidates?.find(candidate => candidate.productId === link.productId
    && candidate.vendorItemId === link.vendorItemId) : undefined
  const product = found?.product ?? null
  return <Sheet open={link !== null} onOpenChange={open => { if (!open) onClose() }}>
    {link && <SheetContent side="right" title={product?.name ?? '상품 정보'} closeLabel="패널 닫기" className="w-96">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6 pt-14">
        {product?.imageUrl && <img src={product.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-md border object-contain" />}
        <h2 className="text-base font-semibold wrap-anywhere text-gray-900">{found ? candidateName(found) : '상품 정보를 불러오는 중…'}</h2>
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
    </SheetContent>}
  </Sheet>
}
