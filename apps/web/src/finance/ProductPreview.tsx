import { useState } from 'react'
import { productImageUrlOf, type ProductInfo } from '@vada/contracts'
import { wonLabel } from './purchase-view'
import { Badge } from '@/components/ui/badge'
import { dayTimeLabel } from '@/lib/korean-date-text'

function ProductImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? (
    <img
      src={url}
      alt={`${name} 상품 사진`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="size-24 shrink-0 rounded-sm border bg-white object-contain"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="flex size-24 shrink-0 items-center justify-center rounded-sm border bg-surface-subtle p-2 text-center text-xs text-fg-muted">
      사진 없음
    </div>
  )
}

// 이름은 공급자가 보낸 판매 단위·포장 수량을 그대로 표시한다. 배송 문구에서 배송비를 추정하지 않는다.
export function ProductPreview({ product }: { product: ProductInfo }) {
  const unit = product.items.find(item => item.itemId === product.selectedItemId)
  const image = productImageUrlOf(product.imageUrl)
  return (
    <div className="flex flex-wrap gap-3 rounded-sm bg-surface-subtle p-3">
      <ProductImage key={image} url={image} name={product.name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fg-tertiary">
        <Badge tone="info" className="self-start">
          불러온 정보
        </Badge>
        <span className="font-medium wrap-anywhere text-fg">{product.name}</span>
        {unit && unit.name !== product.name && (
          <span className="wrap-anywhere">판매 단위 {unit.name}</span>
        )}
        <span>
          {unit?.price == null ? '가격 확인 안 됨' : `불러온 가격 ${wonLabel(unit.price)}`}
        </span>
        <span>{stockLabel(product.inStock)}</span>
        {product.shipping && <span className="wrap-anywhere">{product.shipping}</span>}
        {product.deliveryEta && <span className="wrap-anywhere">{product.deliveryEta}</span>}
        <span>{queryTimeLabel(product.fetchedAt)}</span>
      </div>
    </div>
  )
}

function stockLabel(stock: boolean | null | undefined) {
  return stock === false ? '품절' : stock === true ? '재고 있음' : '재고 확인 안 됨'
}
function queryTimeLabel(value: string | undefined) {
  return value && Number.isFinite(Date.parse(value))
    ? `조회 ${dayTimeLabel(value)}`
    : '조회 시각 확인 안 됨'
}
