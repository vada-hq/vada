// 쿠팡 상품 링크를 찾고 정규화한다. 서버(후보 기록)와 화면(대화 링크 버튼)이 같은 규칙을 쓴다.
export const COUPANG_LINKS_PER_MESSAGE_MAX = 10

export interface CoupangLink {
  // https://www.coupang.com/vp/products/{productId}?itemId=..&vendorItemId=.. 로 정규화한 주소
  url: string
  productId: string
  itemId: string | null
  vendorItemId: string | null
  // 원문에서 링크가 차지하는 위치. 화면이 링크 버튼을 그릴 때 쓴다.
  start: number
  end: number
}

const digits = /^\d{1,20}$/
// URL에 쓸 수 있는 ASCII 문자까지만 링크로 본다. 이어 쓴 한글은 링크가 아니다.
const candidate = /https:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g
// 문장 끝에 붙은 부호는 링크에서 뗀다.
const trailing = /[.,!?;:'")\]}]+$/

export function normalizeCoupangUrl(productId: string, itemId: string | null, vendorItemId: string | null) {
  const url = new URL(`https://www.coupang.com/vp/products/${productId}`)
  if (itemId) url.searchParams.set('itemId', itemId)
  if (vendorItemId) url.searchParams.set('vendorItemId', vendorItemId)
  return url.href
}

export function readCoupangUrl(raw: string): Omit<CoupangLink, 'start' | 'end'> | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
  const pattern = ['www.coupang.com', 'coupang.com'].includes(url.hostname) ? /^\/vp\/products\/(\d{1,20})\/?$/
    : url.hostname === 'm.coupang.com' ? /^\/vm\/products\/(\d{1,20})\/?$/ : null
  const match = pattern?.exec(url.pathname)
  if (!match) return null
  // 값이 숫자 하나일 때만 쓴다. 이상하면 옵션을 모르는 링크로 본다.
  const param = (key: string) => {
    const values = url.searchParams.getAll(key)
    return values.length === 1 && digits.test(values[0]!) ? values[0]! : null
  }
  const productId = match[1]!
  const itemId = param('itemId')
  const vendorItemId = param('vendorItemId')
  return { url: normalizeCoupangUrl(productId, itemId, vendorItemId), productId, itemId, vendorItemId }
}

export function parseCoupangLinks(text: string): CoupangLink[] {
  const links: CoupangLink[] = []
  for (const found of text.matchAll(candidate)) {
    if (links.length >= COUPANG_LINKS_PER_MESSAGE_MAX) break
    const raw = found[0].replace(trailing, '')
    const parsed = readCoupangUrl(raw)
    if (parsed) links.push({ ...parsed, start: found.index, end: found.index + raw.length })
  }
  return links
}
