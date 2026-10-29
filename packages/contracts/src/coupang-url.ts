// 받는 쿠팡 상품 주소의 모양(기능 022 정한 것 13). 앱 공유 단축 링크는 아래 coupangShortLinkOf가 가르고, coupa.ng는 받지 않는다.
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

// 쿠팡 앱 공유 단축 링크(기능 022 정한 것 13). 서버가 이 모양만 한 번 열어 이동할 곳을 읽는다.
// 호스트는 정확히 link.coupang.com이고 https만이다. 여는 주소는 받은 글이 아니라 코드로 다시 만든다(쿼리·조각은 버림).
const SHORT_LINK_HOST = 'link.coupang.com'
const SHORT_LINK_PATH = /^\/a\/([A-Za-z0-9_-]{1,64})\/?$/

// 단축 링크가 아니면 null이다.
export function coupangShortLinkOf(value: string): string | null {
  const url = parsed(value)
  if (!url || url.protocol !== 'https:' || url.hostname !== SHORT_LINK_HOST) return null
  if (url.port || url.username || url.password) return null
  const code = SHORT_LINK_PATH.exec(url.pathname)?.[1]
  return code ? `https://${SHORT_LINK_HOST}/a/${code}` : null
}
