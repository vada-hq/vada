// 받는 쿠팡 상품 주소의 모양(기능 022 정한 것 13). 단축 주소(link.coupang.com, coupa.ng)는 풀지 않는다.
// 어디로 가는지 모르는 주소를 서버가 따라가지 않고, ReefAPI 문서도 단축 주소를 받는다고 적지 않는다.
const PRODUCT_PATHS = new Map([
  ['coupang.com', /^\/vp\/products\/(\d+)\/?$/],
  ['www.coupang.com', /^\/vp\/products\/(\d+)\/?$/],
  ['m.coupang.com', /^\/vm\/products\/(\d+)\/?$/],
])
const DIGITS = /^\d+$/

export interface CoupangProduct {
  // ReefAPI에 보내고 캐시 열쇠로 쓰는 주소. 검색어·추적 값을 버려 사람이 무엇을 찾았는지 밖으로 나가지 않는다(DEC-89 상품 주소만 보냄).
  url: string
  itemId: string | null
  vendorItemId: string | null
}

const parsed = (value: string) => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const numberParam = (params: URLSearchParams, name: string) => {
  const value = params.get(name)
  return value && DIGITS.test(value) ? value : null
}

// 포트나 계정이 붙은 주소는 쿠팡이 링크로 주는 모양이 아니다.
function productIdOf(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.port || url.username || url.password) return null
  return PRODUCT_PATHS.get(url.hostname)?.exec(url.pathname)?.[1] ?? null
}

// 쿠팡 상품 주소가 아니면 null이다(부르지 않는다).
export function coupangProductOf(value: string): CoupangProduct | null {
  const url = parsed(value)
  const productId = url && productIdOf(url)
  if (!url || !productId) return null
  const itemId = numberParam(url.searchParams, 'itemId')
  const vendorItemId = numberParam(url.searchParams, 'vendorItemId')
  const kept = new URLSearchParams()
  if (itemId) kept.set('itemId', itemId)
  if (vendorItemId) kept.set('vendorItemId', vendorItemId)
  const query = kept.size ? `?${kept.toString()}` : ''
  return { url: `https://www.coupang.com/vp/products/${productId}${query}`, itemId, vendorItemId }
}
