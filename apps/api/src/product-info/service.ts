import type { ProductInfoResponse } from '@vada/contracts'
import { createExpiringCache } from './cache.js'
import { coupangProductOf, type CoupangProduct } from './coupang-url.js'
import { createDailyCap } from './daily-cap.js'
import type { LookupOutcome, LookupResult, ProductLookup } from './reef.js'

// ReefAPI는 저장하지 않고 매번 새로 읽는다. 같은 상품을 여러 사람이 여는 동안 크레딧을 아끼려고 짧게 둔다(DEC-89).
// 가격은 초안이고 금액은 승인 때 정하므로(DEC-40) 10분 묵은 값이어도 된다.
const CACHE = { ttlMs: 600_000, max: 500 } // 10분, 500개
// 서버 전체에서 하루에 ReefAPI를 실제로 부르는 횟수의 상한. Pro는 달 10,000 credits이고 한 번에 2 credits라 달 5,000번,
// 30일로 나누면 하루 약 166번이다. 남는 몫을 두고 150번이다. 넘으면 크레딧이 떨어졌을 때처럼 불러오지 못하고 사람이 품목을 적는다.
const REEF_CALLS_PER_DAY = 150
// 크레딧, 키, 하루 상한은 사람이 손볼 일이라 경고 단계로 남긴다.
type LoggedOutcome = LookupOutcome | 'cached' | 'daily_cap'
const WARN = new Set<LoggedOutcome>(['quota', 'auth', 'daily_cap'])

// 성공률을 세는 한 줄(DEC-89). 주소·학생회·사람은 넣지 않는다(AGENTS.md '로그·비밀').
function logOutcome(outcome: LoggedOutcome) {
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
  // 부르는 중인 주소. 같은 주소가 동시에 오면(대화방의 여럿이 같은 링크를 엶) 한 번만 부르고 결과를 나눈다.
  const running = new Map<string, Promise<ProductInfoResponse>>()
  const dailyCap = createDailyCap(REEF_CALLS_PER_DAY)
  async function call(product: CoupangProduct, reef: ProductLookup): Promise<ProductInfoResponse> {
    if (!dailyCap.take(clock())) {
      logOutcome('daily_cap')
      return { product: null, reason: 'unavailable' }
    }
    const result = await reef(product)
    logOutcome(result.outcome)
    const response = responseOf(result)
    if (response.reason !== 'unavailable') cache.set(product.url, response, clock())
    return response
  }
  return async (url: string): Promise<ProductInfoResponse> => {
    const product = coupangProductOf(url)
    if (!product) return { product: null, reason: 'unsupported' }
    if (!lookup) return { product: null, reason: 'unavailable' }
    const ready = cache.get(product.url, clock()) ?? running.get(product.url)
    if (ready) {
      logOutcome('cached')
      return ready
    }
    const started = call(product, lookup).finally(() => running.delete(product.url))
    running.set(product.url, started)
    return started
  }
}
