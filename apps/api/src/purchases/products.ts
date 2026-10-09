import type { CoupangItem } from '../db/schema.js'

export type LookupFailure = 'NOT_CONFIGURED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM' | 'TIMEOUT' | 'INVALID_RESPONSE'
export type FetchResult = { ok: true; items: CoupangItem[] } | { ok: false; code: LookupFailure; retryable: boolean }
export type ProductFetcher = (productId: string, timeoutMs?: number) => Promise<FetchResult>
// 품목에 넣는 조회 결과. 가격은 끼룩이가 아니라 이 값만 쓴다.
export interface ProductLookup {
  name: string | null
  price: number | null
  snapshot: Record<string, unknown> | null
  fetchedAt: Date | null
  warning: string | null
}
export interface LinkIdentity { productId: string; itemId: string | null; vendorItemId: string | null }
export type StoredProduct = { status: 'pending' | 'ready' | 'failed'; items: CoupangItem[]; fetchedAt: Date | null; errorCode: string | null }

export const SELLER_WARNING = '링크의 판매자가 바뀌었을 수 있어요. 쿠팡에서 가격과 판매자를 확인해 주세요.'
export const lookupWarnings = {
  noOption: '링크에 판매 옵션 정보가 없어요. 쿠팡에서 옵션을 고른 뒤 주소창의 링크를 다시 올려 주세요.',
  noMatch: '링크와 일치하는 판매 옵션을 확인하지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.',
  failed: '상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.',
  notConfigured: '상품 조회 서비스가 설정되지 않았어요. 관리자에게 알려 주세요.',
  noPrice: '상품 가격을 확인하지 못했어요. 상품 링크에서 확인해 주세요.',
} as const

const REEF_URL = 'https://api.reefapi.com/coupang/v1/product'
const INTEGER_MAX = 2147483647
const ITEMS_MAX = 100
const digits = /^\d{1,20}$/
const unsafe = /[\u0000\uD800-\uDFFF]/u
const imageHost = /(^|\.)coupangcdn\.com$/

function clip(value: unknown, max: number) {
  if (typeof value !== 'string' || unsafe.test(value)) return null
  const trimmed = value.trim()
  return trimmed ? [...trimmed].slice(0, max).join('') : null
}
const won = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= INTEGER_MAX ? value : null
function imageOf(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && imageHost.test(url.hostname) && !url.username && !url.password && !url.port ? url.href : null
  } catch { return null }
}

// 조회 응답의 옵션 하나를 검사한다. 이름이 없거나 다른 상품이면 버린다.
export function readItem(raw: unknown, productId: string): CoupangItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const item = raw as Record<string, unknown>
  const name = clip(item.name, 500)
  if (item.product_id !== productId || !name) return null
  const id = (value: unknown) => typeof value === 'string' && digits.test(value) ? value : null
  const krw = item.currency === 'KRW'
  const discount = typeof item.discount_percent === 'number' && Number.isFinite(item.discount_percent)
    && item.discount_percent >= 0 && item.discount_percent <= 100 ? Math.round(item.discount_percent) : null
  return { itemId: id(item.item_id), vendorItemId: id(item.vendor_item_id), name, price: krw ? won(item.price) : null,
    listPrice: krw ? won(item.list_price) : null, discountPercent: discount, inStock: typeof item.in_stock === 'boolean' ? item.in_stock : null,
    deliveryEta: clip(item.delivery_eta, 100), imageUrl: imageOf(item.image) }
}

// ReefAPI: https://reefapi.com/docs/coupang — 사용자 URL을 직접 부르지 않고 상품 ID만 보낸다. 상품 ID로 부르면 옵션 전체가 온다.
export function createReefFetcher(apiKey: string | undefined, fetcher: typeof fetch = fetch): ProductFetcher {
  return async (productId, timeoutMs = 15000) => {
    if (!apiKey?.trim()) return { ok: false, code: 'NOT_CONFIGURED', retryable: false }
    if (!digits.test(productId)) return { ok: false, code: 'NOT_FOUND', retryable: false }
    let response: Response
    try {
      response = await fetcher(REEF_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId }) })
    } catch (error) {
      // 원문은 버리고 종류만 남긴다. 시간 초과·네트워크 오류는 과금되지 않아 다시 시도한다.
      return { ok: false, code: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'UPSTREAM', retryable: true }
    }
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    const payload = (body && typeof body === 'object' ? body : {}) as { ok?: unknown; data?: { items?: unknown }; error?: { code?: unknown } | null }
    const code = typeof payload.error?.code === 'string' ? payload.error.code : ''
    if (code === 'NOT_FOUND' || response.status === 404) return { ok: false, code: 'NOT_FOUND', retryable: false }
    if (code === 'RATE_LIMITED' || response.status === 429) return { ok: false, code: 'RATE_LIMITED', retryable: true }
    if (!response.ok || payload.ok !== true) return { ok: false, code: 'UPSTREAM', retryable: true }
    const list = payload.data?.items
    if (!Array.isArray(list)) return { ok: false, code: 'INVALID_RESPONSE', retryable: false }
    const items = list.map(raw => readItem(raw, productId)).filter((item): item is CoupangItem => item !== null).slice(0, ITEMS_MAX)
    return items.length ? { ok: true, items } : { ok: false, code: 'NOT_FOUND', retryable: false }
  }
}

// 링크의 옵션을 찾는다. 판매자가 바뀌면 vendorItemId가 달라지므로 같은 옵션(itemId)이면 쓰되 알린다.
export function matchItem(items: CoupangItem[], link: Pick<LinkIdentity, 'itemId' | 'vendorItemId'>) {
  const byVendor = link.vendorItemId ? items.find(item => item.vendorItemId === link.vendorItemId) : undefined
  if (byVendor) return { item: byVendor, warning: null }
  const byItem = link.itemId ? items.find(item => item.itemId === link.itemId) : undefined
  if (byItem) return { item: byItem, warning: link.vendorItemId ? SELLER_WARNING : null }
  return { item: null, warning: null }
}

// 저장된 상품 정보로 품목에 넣을 값을 만든다.
export function lookupFor(product: StoredProduct | undefined, link: LinkIdentity): ProductLookup {
  const none = (warning: string): ProductLookup => ({ name: null, price: null, snapshot: null, fetchedAt: null, warning })
  if (!product || product.status !== 'ready') return none(product?.errorCode === 'NOT_CONFIGURED' ? lookupWarnings.notConfigured : lookupWarnings.failed)
  if (!link.itemId && !link.vendorItemId) return none(lookupWarnings.noOption)
  const { item, warning } = matchItem(product.items, link)
  if (!item) return none(lookupWarnings.noMatch)
  const snapshot = { provider: 'reef', productId: link.productId, itemId: item.itemId, vendorItemId: item.vendorItemId,
    name: item.name, price: item.price, currency: 'KRW' }
  return { name: item.name, price: item.price, snapshot, fetchedAt: product.fetchedAt,
    warning: warning ?? (item.price === null ? lookupWarnings.noPrice : null) }
}
