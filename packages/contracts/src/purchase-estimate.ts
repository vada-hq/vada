import { WON_MAX } from './budget.js'

export type PurchaseEstimate = { subtotal: number | null; total: number | null }
export type EstimatedPurchaseItem = {
  quantity: number
  estimatedUnitPrice?: number | null
  estimatedShippingFee?: number | null
}

const validWon = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= WON_MAX

// 미확인은 0이 아니다. 배송비가 없으면 상품 합계만 알고, 단가가 없으면 둘 다 모른다.
// 입력 전 초안에도 쓰므로 잘못된 수나 품목 합계 상한을 넘으면 알려진 값으로 표시하지 않는다.
export function purchaseEstimateOf(item: EstimatedPurchaseItem): PurchaseEstimate {
  const { quantity, estimatedUnitPrice: price, estimatedShippingFee: shipping } = item
  const unknown = { subtotal: null, total: null }
  if (price == null || !validWon(price) || !Number.isSafeInteger(quantity) || quantity < 1)
    return unknown
  const subtotal = quantity * price
  if (!validWon(subtotal)) return unknown
  if (shipping == null) return { subtotal, total: null }
  if (!validWon(shipping) || !validWon(subtotal + shipping)) return unknown
  return { subtotal, total: subtotal + shipping }
}

// 일부만 아는 합계를 전체 예상 금액처럼 보이지 않는다. 최대 20품목의 합도 안전한 정수다.
export function purchaseEstimatesOf(items: readonly EstimatedPurchaseItem[]): PurchaseEstimate {
  return items.reduce<PurchaseEstimate>(
    (sum, item) => {
      const estimate = purchaseEstimateOf(item)
      const add = (left: number | null, right: number | null) => {
        if (left === null || right === null) return null
        const value = left + right
        return Number.isSafeInteger(value) ? value : null
      }
      return {
        subtotal: add(sum.subtotal, estimate.subtotal),
        total: add(sum.total, estimate.total),
      }
    },
    { subtotal: 0, total: 0 },
  )
}
