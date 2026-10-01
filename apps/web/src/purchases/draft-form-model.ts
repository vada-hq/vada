import type { PurchaseDetail, UpdatePurchaseDraftRequest } from '@vada/contracts'

export function createDraftValues(request: PurchaseDetail) {
  return {
    purpose: request.purpose ?? '',
    neededBy: request.neededBy ?? '',
    shipping: request.estimatedShippingCost?.toString() ?? '',
    items: request.items.map(item => ({ ...item, productName: item.productName ?? '',
      selectedOption: item.selectedOption ?? '', packagingUnit: item.packagingUnit ?? '',
      quantity: item.quantity?.toString() ?? '', estimatedUnitPrice: item.estimatedUnitPrice?.toString() ?? '' })),
  }
}
export type DraftValues = ReturnType<typeof createDraftValues>
const toNumber = (value: string) => value.trim() === '' ? null : Number(value)
const text = (value: string) => value.trim() || null

// UI 입력 검증만 담당한다. 저장·제출의 최종 검증은 서버에서 수행한다.
export function analyzeDraft({ purpose, neededBy, shipping, items }: DraftValues) {
  const invalid = items.some(item => [item.quantity, item.estimatedUnitPrice].some((value, index) => value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < (index ? 0 : 1) || Number(value) > 2147483647))) || (shipping !== '' && (!Number.isSafeInteger(Number(shipping)) || Number(shipping) < 0 || Number(shipping) > 2147483647))
  const missing = [
    ...(!purpose.trim() ? ['구매 목적'] : []), ...(!neededBy ? ['필요한 날짜'] : []),
    ...(!items.length ? ['구매 품목'] : []),
    ...items.flatMap((item, index) => [
      ...(!item.productName.trim() ? [`물품 ${index + 1} 상품명`] : []),
      ...(!item.productUrl ? [`물품 ${index + 1} 상품 링크`] : []),
      ...(!item.quantity || Number(item.quantity) < 1 ? [`물품 ${index + 1} 주문 수량`] : []),
      ...(item.optionRequired === null ? [`물품 ${index + 1} 옵션 필요 여부`] : []),
      ...(item.optionRequired === true && !item.selectedOption.trim() ? [`물품 ${index + 1} 선택 옵션`] : []),
    ]),
  ]
  let total: number | null = toNumber(shipping)
  if (items.some(item => item.quantity === '' || item.estimatedUnitPrice === '') || invalid) total = null
  else if (total !== null) { total += items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.estimatedUnitPrice), 0); if (!Number.isSafeInteger(total)) total = null }
  return { invalid, missing, total }
}

export function serializeDraft({ purpose, neededBy, shipping, items }: DraftValues, version: number): UpdatePurchaseDraftRequest {
  return { version, purpose: text(purpose), neededBy: neededBy || null, estimatedShippingCost: toNumber(shipping),
    items: items.map(item => ({ id: item.id, productName: text(item.productName), selectedOption: text(item.selectedOption),
      optionRequired: item.optionRequired, quantity: toNumber(item.quantity), packagingUnit: text(item.packagingUnit), estimatedUnitPrice: toNumber(item.estimatedUnitPrice) })) }
}
