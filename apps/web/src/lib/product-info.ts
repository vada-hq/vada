import { useEffect, useState } from 'react'
import type { ProductInfo, ProductInfoRequest, ProductInfoResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { chatBase } from '../chat/chat-api'

// 쿠팡 상품 정보 읽기 `POST product-info`(022 조각 4). 아무것도 바꾸지 않지만 credits를 써서 변경 경로 모양이다.
const productInfoPath = (councilId: string) => `${chatBase(councilId)}/product-info`

// 불러오는 중, 불러옴, 없음(못 불러옴·쿠팡이 없다고 함·연결 실패). 못 불러와도 막지 않고 '상품 정보 없음'으로 보인다(DEC-89).
export type ProductState =
  { kind: 'loading' } | { kind: 'ready'; product: ProductInfo } | { kind: 'none' }

export async function readProductInfo(councilId: string, url: string): Promise<ProductState> {
  const result = await postJson<ProductInfoResponse>(productInfoPath(councilId), {
    url,
  } satisfies ProductInfoRequest)
  return result.ok && result.data.product
    ? { kind: 'ready', product: result.data.product }
    : { kind: 'none' }
}

// 주소 하나의 상품 정보. 주소가 바뀌면 다시 읽고, 늦게 온 앞 주소의 응답은 버린다.
export function useProductInfo(councilId: string, url: string) {
  const [state, setState] = useState<{ url: string; value: ProductState }>({
    url,
    value: { kind: 'loading' },
  })
  useEffect(() => {
    let live = true
    void readProductInfo(councilId, url).then(value => {
      if (live) setState({ url, value })
    })
    return () => {
      live = false
    }
  }, [councilId, url])
  return state.url === url ? state.value : ({ kind: 'loading' } as const)
}
