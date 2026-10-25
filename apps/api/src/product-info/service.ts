import type { ProductInfoResponse } from '@vada/contracts'
import { createExpiringCache } from './cache.js'
import { coupangProductOf } from './coupang-url.js'
import type { LookupOutcome, LookupResult, ProductLookup } from './reef.js'

// ReefAPI는 저장하지 않고 매번 새로 읽는다. 같은 상품을 여러 사람이 여는 동안 크레딧을 아끼려고 짧게 둔다(DEC-89).
// 가격은 초안이고 금액은 승인 때 정하므로(DEC-40) 10분 묵은 값이어도 된다.
const CACHE = { ttlMs: 600_000, max: 500 } // 10분, 500개
// 크레딧과 키는 사람이 손볼 일이라 경고 단계로 남긴다.
const WARN = new Set<LookupOutcome | 'cached'>(['quota', 'auth'])

// 성공률을 세는 한 줄(DEC-89). 주소·학생회·사람은 넣지 않는다(AGENTS.md '로그·비밀').
function logOutcome(outcome: LookupOutcome | 'cached') {
  const line = JSON.stringify({ event: 'product_info', outcome })
  if (WARN.has(outcome)) console.warn(line)
  else console.log(line)
}

function responseOf(result: LookupResult): ProductInfoResponse {
  if (result.outcome === 'ok') return { product: result.product, reason: null }
  return { product: null, reason: result.outcome === 'not_found' ? 'not_found' : 'unavailable' }
}

// lookup이 없으면(키 없음) 불러오기만 꺼진다. 쿠팡 상품 주소가 아니면 부르지 않는다.
export function createProductInfo({
  lookup,
  clock,
}: {
  lookup: ProductLookup | undefined
  clock: () => Date
}) {
  // 실패(unavailable)는 두지 않는다. 실패한 호출은 무료이고 차단은 곧 풀릴 수 있다.
  const cache = createExpiringCache<ProductInfoResponse>(CACHE)
  return async (url: string): Promise<ProductInfoResponse> => {
    const product = coupangProductOf(url)
    if (!product) return { product: null, reason: 'unsupported' }
    if (!lookup) return { product: null, reason: 'unavailable' }
    const cached = cache.get(product.url, clock())
    if (cached) {
      logOutcome('cached')
      return cached
    }
    const result = await lookup(product)
    logOutcome(result.outcome)
    const response = responseOf(result)
    if (response.reason !== 'unavailable') cache.set(product.url, response, clock())
    return response
  }
}
