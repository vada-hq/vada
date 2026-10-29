import type { ProductInfoResponse } from '@vada/contracts'
import { createExpiringCache } from './cache.js'
import { coupangProductOf, coupangShortLinkOf, type CoupangProduct } from './coupang-url.js'
import { createDailyCap } from './daily-cap.js'
import {
  LOOKUP_BUDGET_MS,
  type LookupOutcome,
  type LookupResult,
  type ProductLookup,
} from './reef.js'
import type { ShortLinkCode, ShortLinkResolver } from './short-link.js'

// ReefAPI는 저장하지 않고 매번 새로 읽는다. 같은 상품을 여러 사람이 여는 동안 크레딧을 아끼려고 짧게 둔다(DEC-89).
// 가격은 초안이고 금액은 승인 때 정하므로(DEC-40) 10분 묵은 값이어도 된다.
const CACHE = { ttlMs: 600_000, max: 500 } // 10분, 500개
// 서버 전체에서 하루에 ReefAPI를 실제로 부르는 횟수의 상한. Pro는 달 10,000 credits이고 한 번에 2 credits라 달 5,000번,
// 30일로 나누면 하루 약 166번이다. 남는 몫을 두고 150번이다. 넘으면 크레딧이 떨어졌을 때처럼 불러오지 못하고 사람이 품목을 적는다.
const REEF_CALLS_PER_DAY = 150
// 크레딧, 키, 하루 상한은 사람이 손볼 일이라 경고 단계로 남긴다.
type LoggedOutcome = LookupOutcome | 'cached' | 'daily_cap' | 'short_failed'
const WARN = new Set<LoggedOutcome>(['quota', 'auth', 'daily_cap'])
// 단축 링크를 못 풀었을 때: 이동할 곳이 상품 주소가 아니면 받지 않는 주소와 같고, 시간 초과·연결 실패는 곧 풀릴 수 있다.
const SHORT_TRANSIENT = new Set<ShortLinkCode>(['timeout', 'network'])
const UNSUPPORTED: ProductInfoResponse = { product: null, reason: 'unsupported' }
const UNAVAILABLE: ProductInfoResponse = { product: null, reason: 'unavailable' }

// 성공률을 세는 한 줄(DEC-89). 주소·학생회·사람은 넣지 않는다(AGENTS.md '로그·비밀').
// 단축 링크로 온 것은 푼 결과 코드(short)만 더한다. 단축 링크의 코드와 이동할 곳은 넣지 않는다.
function logOutcome(outcome: LoggedOutcome, diag?: LookupResult['diag'], short?: ShortLinkCode) {
  const line = JSON.stringify({
    event: 'product_info',
    outcome,
    ...(diag ? { code: diag.code, status: diag.status, attempts: diag.attempts } : {}),
    ...(short ? { short } : {}),
  })
  if (WARN.has(outcome)) console.warn(line)
  else console.log(line)
}

function responseOf(result: LookupResult, fetchedAt: Date): ProductInfoResponse {
  if (result.outcome === 'ok')
    return { product: { ...result.product, fetchedAt: fetchedAt.toISOString() }, reason: null }
  return { product: null, reason: result.outcome === 'not_found' ? 'not_found' : 'unavailable' }
}

// 다른 요청이 먼저 시작한 같은 상품 조회에 합류할 때, 단축 링크를 푸느라 쓴 시간만큼 덜 기다린다.
// 그 조회는 자기 10초를 쓰므로 그대로 기다리면 이 요청은 10초를 넘는다. 남은 몫이 지나면 unavailable이다.
function withinBudget(pending: Promise<ProductInfoResponse> | undefined, spentMs: number) {
  if (!pending || !spentMs) return pending
  return new Promise<ProductInfoResponse>((resolve, reject) => {
    const timer = setTimeout(() => resolve(UNAVAILABLE), Math.max(LOOKUP_BUDGET_MS - spentMs, 0))
    void pending.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

type Target = { product: CoupangProduct; spentMs: number; short?: 'ok' }

// 단축 링크를 풀어 상품 주소와 쓴 시간을 얻는다. 못 풀면 바로 돌려줄 응답이다.
async function targetOfShort(
  url: string,
  resolve: ShortLinkResolver,
  clock: () => Date,
): Promise<Target | ProductInfoResponse> {
  const started = clock().getTime()
  const resolved = await resolve(url)
  if (resolved.code !== 'ok') {
    logOutcome('short_failed', undefined, resolved.code)
    return SHORT_TRANSIENT.has(resolved.code) ? UNAVAILABLE : UNSUPPORTED
  }
  return { product: resolved.product, spentMs: clock().getTime() - started, short: 'ok' }
}

// lookup이 없으면(키 없음) 불러오기만 꺼진다. 쿠팡 상품 주소가 아니면 부르지 않는다.
// 단축 링크는 resolveShortLink가 있을 때만 상품 주소로 풀고, 풀린 상품 주소로 캐시·ReefAPI를 쓴다(기능 022 정한 것 13).
export function createProductInfo({
  lookup,
  resolveShortLink,
  clock,
}: {
  lookup: ProductLookup | undefined
  resolveShortLink?: ShortLinkResolver | undefined
  clock: () => Date
}) {
  // 실패(unavailable)는 두지 않는다. 실패한 호출은 무료이고 차단은 곧 풀릴 수 있다.
  const cache = createExpiringCache<ProductInfoResponse>(CACHE)
  // 부르는 중인 주소. 같은 주소가 동시에 오면(대화방의 여럿이 같은 링크를 엶) 한 번만 부르고 결과를 나눈다.
  const running = new Map<string, Promise<ProductInfoResponse>>()
  const dailyCap = createDailyCap(REEF_CALLS_PER_DAY)
  async function call(target: Target, reef: ProductLookup): Promise<ProductInfoResponse> {
    if (!dailyCap.take(clock())) {
      logOutcome('daily_cap', undefined, target.short)
      return UNAVAILABLE
    }
    const result = await reef(target.product, target.spentMs)
    logOutcome(result.outcome, result.diag, target.short)
    const response = responseOf(result, clock())
    if (response.reason !== 'unavailable') cache.set(target.product.url, response, clock())
    return response
  }
  // 같은 상품이 캐시에 있거나 부르는 중이면 그것을 쓰고, 아니면 ReefAPI를 부른다.
  function fromTarget(target: Target, reef: ProductLookup): Promise<ProductInfoResponse> {
    const key = target.product.url
    const ready = cache.get(key, clock()) ?? withinBudget(running.get(key), target.spentMs)
    if (ready) {
      logOutcome('cached', undefined, target.short)
      return Promise.resolve(ready)
    }
    const started = call(target, reef).finally(() => running.delete(key))
    running.set(key, started)
    return started
  }
  return async (url: string): Promise<ProductInfoResponse> => {
    const product = coupangProductOf(url)
    // 긴 주소는 기다림 없이 바로 진행 조회에 올린다. 같은 주소가 동시에 와도 한 번만 부른다.
    if (product) return lookup ? fromTarget({ product, spentMs: 0 }, lookup) : UNAVAILABLE
    if (!resolveShortLink || !coupangShortLinkOf(url)) return UNSUPPORTED
    // 키가 없으면 단축 링크도 풀지 않는다(쿠팡을 부를 까닭이 없다).
    if (!lookup) return UNAVAILABLE
    const target = await targetOfShort(url, resolveShortLink, clock)
    return 'spentMs' in target ? fromTarget(target, lookup) : target
  }
}
