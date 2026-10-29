import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { ProductInfo } from '@vada/contracts'
import { PRODUCT_NONE_REASON } from '@/lib/product-info'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { wonLabel } from '../finance/purchase-view'
import type { ProductState } from './product-info'

// 판매 단위 한 줄: 이름과 가격, 정가가 다르면 지운 줄의 정가. 가격은 오른쪽 정렬 고정폭 숫자다.
function Unit({ item }: { item: ProductInfo['items'][number] }) {
  const listed = item.listPrice !== null && item.listPrice !== item.price
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
      <span className="min-w-0 break-keep wrap-anywhere text-gray-800">{item.name}</span>
      <span className="flex shrink-0 flex-col items-end tabular-nums">
        {item.price === null ? (
          <span className="text-gray-500">가격 없음</span>
        ) : (
          <span className="font-semibold text-gray-900">{wonLabel(item.price)}</span>
        )}
        {listed && (
          <span className="text-xs text-gray-500">
            <span className="sr-only">정가 </span>
            <s>{wonLabel(item.listPrice ?? 0)}</s>
          </span>
        )}
      </span>
    </li>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-keep wrap-anywhere text-gray-800">{children}</dd>
    </>
  )
}

// 불러온 상품(022 정한 것 20): '불러온 정보' 표시, 상품명, 판매 단위 목록, 배송, 도착 예정. 값은 초안이라 사람이 요청에서 고친다(PRIN-2).
function Loaded({ product }: { product: ProductInfo }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">불러온 정보</Badge>
      </div>
      <p className="text-base font-semibold break-keep wrap-anywhere text-gray-900">
        {product.name}
      </p>
      <ul aria-label="판매 단위" className="flex flex-col divide-y rounded-md border">
        {product.items.map(item => (
          <Unit key={item.itemId} item={item} />
        ))}
      </ul>
      {(product.shipping || product.deliveryEta) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {product.shipping && <Fact label="배송">{product.shipping}</Fact>}
          {product.deliveryEta && <Fact label="도착 예정">{product.deliveryEta}</Fact>}
        </dl>
      )}
    </div>
  )
}

// 불러오는 동안의 자리 표시: 상품명·판매 단위 자리를 회색 막대로 둔다(자리가 바뀌어 밀리지 않게).
function Placeholder() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <span className="h-5 w-24 rounded-sm bg-gray-100" />
      <span className="h-6 w-4/5 rounded-sm bg-gray-100" />
      <span className="h-20 rounded-md bg-gray-100" />
    </div>
  )
}

type Props = {
  state: ProductState
  url: string
  // [구매 요청 만들기] 또는 막힌 메시지의 [구매 요청 보기]. 권한이 없으면 없다.
  request?: ReactNode
}

// 상품 정보 패널의 내용. 못 불러와도 까닭과 [쿠팡에서 열기]로 확인할 길을 둔다(DEC-89).
export default function ProductDetails({ state, url, request }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {state.kind === 'loading' && (
        <>
          <StateMessage kind="loading">상품 정보 불러오는 중…</StateMessage>
          <Placeholder />
        </>
      )}
      {state.kind === 'none' && (
        <div className="flex flex-col gap-1 break-keep">
          <StateMessage kind="empty">상품 정보 없음</StateMessage>
          <p className="text-sm text-muted-foreground">{PRODUCT_NONE_REASON[state.reason]}</p>
        </div>
      )}
      {state.kind === 'ready' && <Loaded product={state.product} />}
      <div className="flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', touch: true })}
        >
          쿠팡에서 열기
          <ExternalLink aria-hidden />
        </a>
        {state.kind === 'ready' && request}
      </div>
    </div>
  )
}
