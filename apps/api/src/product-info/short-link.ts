import { createExpiringCache } from './cache.js'
import { coupangProductOf, coupangShortLinkOf, type CoupangProduct } from './coupang-url.js'

// 쿠팡 앱 공유 단축 링크(https://link.coupang.com/a/<코드>)를 상품 주소로 푼다(기능 022 정한 것 13).
// 단축 링크는 302 한 번으로 www.coupang.com 상품 주소로 간다. 서버는 그 한 번만 열어 Location을 읽고,
// 이동할 곳은 열지 않는다. 그래서 바깥으로 나가는 요청은 늘 link.coupang.com 하나다(SSRF·오픈 리다이렉트를 막음).
// ReefAPI 10초 안에서 쓰므로 짧게 끊는다. 남은 몫은 ReefAPI 호출이 쓴다(service.ts).
const TIMEOUT_MS = 3_000
// 같은 공유 링크는 늘 같은 상품을 가리킨다. 대화방의 여럿이 열거나 선조회 뒤 다시 열 때 쿠팡을 다시 부르지 않게
// 상품 캐시와 같은 10분, 500개로 둔다.
const CACHE = { ttlMs: 600_000, max: 500 }
const MOVED_PERMANENTLY = 301
const FOUND = 302
const SEE_OTHER = 303
const TEMPORARY_REDIRECT = 307
const PERMANENT_REDIRECT = 308
const REDIRECTS = new Set([
  MOVED_PERMANENTLY,
  FOUND,
  SEE_OTHER,
  TEMPORARY_REDIRECT,
  PERMANENT_REDIRECT,
])

// 로그에 남기는 결과 코드. 원문 주소·코드·Location은 남기지 않는다.
export type ShortLinkCode =
  'ok' | 'not_short' | 'bad_status' | 'no_location' | 'bad_location' | 'timeout' | 'network'
export type ShortLinkResult =
  { code: 'ok'; product: CoupangProduct } | { code: Exclude<ShortLinkCode, 'ok'> }
export type ShortLinkResolver = (url: string) => Promise<ShortLinkResult>

// 이동할 곳은 데스크탑 쿠팡 상품 주소(https, www.coupang.com·coupang.com의 /vp/products/숫자)만 받는다.
// 상대 주소, 다른 호스트, 포트·계정, 다시 단축 링크(다중 홉)는 모두 bad_location이다.
const DESKTOP_HOSTS = new Set(['www.coupang.com', 'coupang.com'])
function desktopProductOf(location: string) {
  let url: URL
  try {
    url = new URL(location)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !DESKTOP_HOSTS.has(url.hostname)) return null
  return coupangProductOf(location)
}

function resultOf(response: Response): ShortLinkResult {
  if (!REDIRECTS.has(response.status)) return { code: 'bad_status' }
  const location = response.headers.get('location')
  if (!location) return { code: 'no_location' }
  const product = desktopProductOf(location)
  return product ? { code: 'ok', product } : { code: 'bad_location' }
}

async function openOnce(
  fetcher: typeof fetch,
  shortUrl: string,
  timeoutMs: number,
): Promise<ShortLinkResult> {
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    // 자동으로 따라가지 않는다. 쿠키·인증 머리를 보내지 않는다.
    const response = await fetcher(shortUrl, { redirect: 'manual', signal, credentials: 'omit' })
    // 본문은 읽지 않고 버린다.
    await response.body?.cancel().catch(() => undefined)
    return resultOf(response)
  } catch (error) {
    const timedOut = signal.aborted || (error instanceof Error && error.name === 'TimeoutError')
    return { code: timedOut ? 'timeout' : 'network' }
  }
}

export function createShortLinkResolver({
  fetcher = fetch,
  clock,
  timeoutMs = TIMEOUT_MS,
}: {
  fetcher?: typeof fetch
  clock: () => Date
  timeoutMs?: number
}): ShortLinkResolver {
  // 실패는 두지 않는다. 시간 초과·연결 실패는 곧 풀릴 수 있다.
  const cache = createExpiringCache<ShortLinkResult>(CACHE)
  const running = new Map<string, Promise<ShortLinkResult>>()
  return async url => {
    const shortUrl = coupangShortLinkOf(url)
    if (!shortUrl) return { code: 'not_short' }
    const ready = cache.get(shortUrl, clock()) ?? running.get(shortUrl)
    if (ready) return ready
    const started = openOnce(fetcher, shortUrl, timeoutMs)
      .then(result => {
        if (result.code === 'ok') cache.set(shortUrl, result, clock())
        return result
      })
      .finally(() => running.delete(shortUrl))
    running.set(shortUrl, started)
    return started
  }
}
