import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { ProductInfo } from '@vada/contracts'
import { PRODUCT_NONE_REASON } from '@/lib/product-info'
import StateMessage from '@/components/StateMessage'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { buttonVariants } from '@/components/ui/button'
import { ProductPreview } from '../finance/ProductPreview'
import { wonLabel } from '../finance/purchase-view'
import type { ProductState } from './product-info'

// 불러온 상품(022 정한 것 20): 구매 요청 화면과 같은 상품 카드(사진·이름·가격·재고·배송)를 보인다.
// 판매 단위가 여럿이면 카드 아래에서 하나를 고르고, 카드와 구매 요청은 고른 단위를 따른다. 값은 초안이라 사람이 요청에서 고친다(PRIN-2).
function Loaded({
  product,
  onItemChange,
}: {
  product: ProductInfo
  onItemChange: (itemId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <ProductPreview product={product} />
      {product.items.length > 1 && (
        <Field label="판매 단위">
          <NativeSelect
            value={product.selectedItemId}
            onChange={event => onItemChange(event.target.value)}
          >
            {product.items.map(item => (
              <option key={item.itemId} value={item.itemId}>
                {item.price === null ? item.name : `${item.name} · ${wonLabel(item.price)}`}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
    </div>
  )
}

// 불러오는 동안의 자리 표시: 상품명·판매 단위 자리를 회색 막대로 둔다(자리가 바뀌어 밀리지 않게).
function Placeholder() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <span className="h-5 w-24 rounded-sm bg-surface-muted" />
      <span className="h-6 w-4/5 rounded-sm bg-surface-muted" />
      <span className="h-20 rounded-md bg-surface-muted" />
    </div>
  )
}

type Props = {
  state: ProductState
  url: string
  // [구매 요청 만들기] 또는 막힌 메시지의 [구매 요청 보기]. 권한이 없으면 없다.
  request?: ReactNode
  // 고른 판매 단위. 불러온 상품의 selectedItemId를 이 값으로 바꿔 보인다.
  itemId?: string | undefined
  onItemChange?: (itemId: string) => void
}

// 상품 정보 패널의 내용. 못 불러와도 까닭과 [쿠팡에서 열기]로 확인할 길을 둔다(DEC-89).
export default function ProductDetails({ state, url, request, itemId, onItemChange }: Props) {
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
      {state.kind === 'ready' && (
        <Loaded product={withItem(state.product, itemId)} onItemChange={id => onItemChange?.(id)} />
      )}
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

// 고른 판매 단위를 상품의 selectedItemId로 둔다. 없는 단위면 불러온 그대로다.
export function withItem(product: ProductInfo, itemId: string | undefined): ProductInfo {
  return itemId && product.items.some(item => item.itemId === itemId)
    ? { ...product, selectedItemId: itemId }
    : product
}
