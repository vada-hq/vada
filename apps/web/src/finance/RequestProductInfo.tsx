import { coupangProductOf } from '@vada/contracts'
import { useProductInfo } from '@/lib/product-info'
import { ProductPreview } from './ProductPreview'

function LoadedProduct({ councilId, link }: { councilId: string; link: string }) {
  const state = useProductInfo(councilId, link)
  return state.kind === 'ready' ? (
    <ProductPreview product={state.product} />
  ) : (
    <p className="text-xs text-gray-500">
      {state.kind === 'loading'
        ? '상품 정보를 불러오는 중이에요.'
        : '상품 정보를 읽지 못했어요. 요청에 남은 품목 정보로 확인해 주세요.'}
    </p>
  )
}

export function RequestProductInfo({
  councilId,
  link,
}: {
  councilId?: string | undefined
  link: string | null
}) {
  return councilId && link && coupangProductOf(link) ? (
    <LoadedProduct councilId={councilId} link={link} />
  ) : null
}
