import { z } from 'zod'
import { itemLinkInput } from './purchases.js'

// 쿠팡 상품 정보 불러오기(DEC-89, 기능 022). 화면이 대화의 상품 링크로 이름·판매 단위별 가격·배송을 받는다.
// 불러온 값은 초안이다. 품목에는 이름만 채우고 가격은 보이기만 한다(금액은 승인 때 정한다, DEC-40).
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
