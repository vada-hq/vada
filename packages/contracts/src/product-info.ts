import { z } from 'zod'
import { itemLinkInput } from './purchases.js'

// 쿠팡 상품 정보 불러오기(DEC-89, 기능 022). 화면이 대화의 상품 링크로 이름·판매 단위별 가격·배송을 받는다.
// 불러온 값은 초안이다. 024-11은 예상 단가·무료 확인 배송비를 채우고, 실제 금액은 승인 때 정한다.
export const ProductInfoSchema = z.strictObject({ url: itemLinkInput })
export type ProductInfoRequest = z.infer<typeof ProductInfoSchema>

// 못 불러온 까닭. unsupported: 쿠팡 상품 주소가 아니라 부르지 않았다. not_found: 그런 상품이 없다. unavailable: 지금은 못 불러온다(꺼짐, 차단, 시간 초과 등).
export const PRODUCT_INFO_REASONS = ['unsupported', 'not_found', 'unavailable'] as const
export type ProductInfoReason = (typeof PRODUCT_INFO_REASONS)[number]

// 판매 단위(쿠팡 item) 하나. 가격과 정가는 원이고, 쿠팡이 주지 않으면 null이다.
export interface ProductInfoItem {
  itemId: string
  name: string
  price: number | null
  listPrice: number | null
}

// 이름·배송·도착 예정·로켓은 고른 판매 단위(selectedItemId)의 것이다.
export interface ProductInfo {
  // 구 버전 캐시/클라이언트와 호환한다. 값이 없으면 확인 안 됨이다.
  imageUrl?: string | null
  inStock?: boolean | null
  // 공급자 데이터가 아닌 본 시스템의 실제 조회 완료 시각. 캐시 적중 때 갱신하지 않는다.
  fetchedAt?: string
  name: string
  items: ProductInfoItem[]
  selectedItemId: string
  shipping: string | null
  deliveryEta: string | null
  rocket: boolean
}

// 못 불러와도 200이다(막지 않는다, DEC-89). 그때 product는 null이고 reason이 까닭이다.
export type ProductInfoResponse =
  { product: ProductInfo; reason: null } | { product: null; reason: ProductInfoReason }

// 공급자 응답과 화면에 같은 기준을 쓴다. 사진을 서버에서 별도로 가져오지 않는다.
const PRODUCT_IMAGE_URL_MAX = 2000
export function productImageUrlOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > PRODUCT_IMAGE_URL_MAX) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'coupangcdn.com' || url.hostname.endsWith('.coupangcdn.com'))
      ? url.href
      : null
  } catch {
    return null
  }
}
