import { object, productUrl, text } from './validation.js'

export interface ProductLookup {
  name: string | null
  price: number | null
  snapshot: Record<string, unknown> | null
  fetchedAt: Date | null
  warning: string | null
}
// ReefAPI: https://reefapi.com/docs/coupang — 사용자 URL을 직접 fetch하지 않는다.
export async function readProduct(raw: string, apiKey = '', fetcher: typeof fetch = fetch): Promise<ProductLookup> {
  const url = new URL(productUrl(raw))
  const unavailable = (code: string): ProductLookup => ({ name: null, price: null, snapshot: null, fetchedAt: null, warning: code })
  const productId = url.pathname.split('/').pop()!
  const itemId = url.searchParams.get('itemId')
  const vendorItemId = url.searchParams.get('vendorItemId')
  if (!vendorItemId) return unavailable('링크에 판매 옵션 식별자가 없습니다. 쿠팡에서 옵션을 선택한 뒤 주소창의 링크를 다시 복사해 주세요.')
  if (!apiKey.trim()) return unavailable('상품 조회 서비스가 설정되지 않았습니다. 관리자에게 문의해 주세요.')
  try {
    const response = await fetcher('https://api.reefapi.com/coupang/v1/product', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: itemId ?? productId }),
    })
    if (!response.ok) { await response.body?.cancel(); return unavailable('상품 조회에 실패했습니다. 상품명·옵션·가격을 직접 확인해 주세요.') }
    const payload = object(await response.json())
    const data = object(payload.data)
    if (payload.ok !== true || !Array.isArray(data.items)) return unavailable('상품 조회 응답을 확인할 수 없습니다. 상품명·옵션·가격을 직접 확인해 주세요.')
    // itemId가 없는 링크는 상품 전체 조회 후 판매 옵션을 정확히 대조한다.
    const matches = data.items.map(object).filter(item => item.product_id === productId &&
      item.vendor_item_id === vendorItemId && (itemId === null || item.item_id === itemId))
    if (matches.length !== 1) return unavailable('링크와 정확히 일치하는 판매 옵션을 확인하지 못했습니다. 상품명·옵션·가격을 직접 확인해 주세요.')
    const item = matches[0]!
    if (typeof item.item_id !== 'string' || !/^\d+$/.test(item.item_id)) return unavailable('상품 식별 정보를 확인하지 못했습니다. 상품명·옵션·가격을 직접 확인해 주세요.')
    const name = text(item.name, 500)
    const price = item.currency === 'KRW' && typeof item.price === 'number' && Number.isSafeInteger(item.price) && item.price >= 0 && item.price <= 2147483647 ? item.price : null
    const snapshot = { provider: 'reef', productId, itemId: item.item_id, vendorItemId, name, price,
      currency: typeof item.currency === 'string' && item.currency.length <= 10 ? item.currency : null }
    return { name, price, snapshot, fetchedAt: new Date(), warning: price === null ? '상품 가격을 확인하지 못했습니다. 상품 링크에서 확인해 주세요.' : null }
  } catch {
    // 외부 오류 원문·키·URL·대화를 응답/로그에 노출하지 않는다.
    return unavailable('상품 조회가 지연되거나 응답을 확인할 수 없습니다. 상품명·옵션·가격을 직접 확인해 주세요.')
  }
}
