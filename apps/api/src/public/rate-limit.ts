import type { Context, MiddlewareHandler } from 'hono'
import { carriesSecret, hashToken, opensToAnyone, tokenOfRequest } from './tokens.ts'

// 마구 넣어 보는 것을 막는다.
//
// **로그인이 없는 자리에서 토큰이 유일한 벽이다.** 막지 않으면 그 벽이 벽이 아니다 —
// 22자 난수라도 초당 수천 번 넣어 보면 언젠가 열린다.
//
// ## 한 축만 막으면 못 막는다
//
// **주소만 막으면 정상 참가자가 다 막힌다.** 캠퍼스는 NAT 뒤라 행사장 전체가 주소
// 하나로 보인다 — 줄 서서 찍는 200명이 한 사람으로 세어진다.
//
// **토큰만 막으면 공격자 하나가 행사 전체의 한도를 쓴다.** 같은 QR을 모두가 찍으므로
// 그 토큰의 한도가 곧 행사의 한도가 된다.
//
// 그래서 축마다 다른 한도를 둔다. 그리고 **틀린 시도를 더 무겁게 센다** — 맞는 열쇠로
// 여러 번 부르는 것(새로고침)과 틀린 열쇠를 넣어 보는 것은 다른 일이다.

export interface Window {
  /** 세는 시간(ms). */
  ms: number
  /** 그 안에 허용하는 무게. */
  weight: number
}

export interface Limits {
  /** 주소마다. 캠퍼스 NAT을 생각해 넉넉하다. */
  perAddress: Window
  /** 토큰마다. 한 행사가 통째로 막히지 않을 만큼. */
  perToken: Window
  /** 틀린 시도의 무게. 맞는 것은 1이다. */
  failureWeight: number
}

export const DEFAULT_LIMITS: Limits = {
  // 200명이 10분에 걸쳐 찍으면 주소 하나로 200번이다. 새로고침을 생각해 여유를 둔다.
  perAddress: { ms: 60_000, weight: 600 },
  // 같은 QR을 여럿이 찍으므로 토큰 쪽이 더 넉넉해야 한다.
  perToken: { ms: 60_000, weight: 2_000 },
  // 틀린 열쇠 하나는 맞는 요청 스물과 같은 무게다.
  failureWeight: 20,
}

interface Bucket {
  weight: number
  until: number
}

/**
 * 센 것을 담아 두는 곳.
 *
 * **프로세스 안이다.** 계산이 하나인 동안은 이것으로 충분하고, 늘리면 표나 캐시로
 * 옮겨야 한다 — 그 사실을 숨기지 않는다.
 */
export interface Counter {
  add(key: string, weight: number, window: Window, now: number): { over: boolean; retryAfterMs: number }
}

export function inMemoryCounter(): Counter {
  const buckets = new Map<string, Bucket>()
  return {
    add(key, weight, window, now) {
      const bucket = buckets.get(key)
      if (bucket === undefined || bucket.until <= now) {
        buckets.set(key, { weight, until: now + window.ms })
        return { over: weight > window.weight, retryAfterMs: window.ms }
      }
      bucket.weight += weight
      return { over: bucket.weight > window.weight, retryAfterMs: bucket.until - now }
    },
  }
}

export interface RateLimitDeps {
  counter: Counter
  limits?: Limits
  now?: () => number
}

/** 몇 초 뒤에 다시 오라고 말한다. 말하지 않으면 상대는 계속 두드린다. */
function retryAfter(ms: number): string {
  return String(Math.max(1, Math.ceil(ms / 1000)))
}

/**
 * 여기서 세는 자리.
 *
 * **열쇠 하나가 벽인 곳이다.** 밖에서 열리는 자리가 그렇고(로그인이 없다 — 계약의
 * `public`이 그것을 말한다. 주소 앞자리로 갈랐던 동안 `/api/sign-in/*`이 새어 있었다), 로그인이
 * 있어도 **주소에 실린 값이 곧 열쇠인 자리**가 그렇다 — 학생회에 들어오는 초대 코드가
 * 그것이다(`GET /api/organizations/by-invite-code/{inviteCode}`). 로그인은 '누가
 * 두드리는지'만 정하고 코드를 못 맞히게 하지는 않는다.
 *
 * **어느 자리가 그런지는 계약이 안다**(`x-secret`). 주소로 판별하면 새 자리가 생길
 * 때마다 여기가 뒤처지고, 뒤처진 규칙은 조용하다.
 *
 * 그 밖의 안쪽 자리는 세션이 벽이므로 세지 않는다 — 세면 한 사람이 많이 쓰는 것과
 * 여럿이 두드리는 것을 가릴 수 없다.
 *
 * **아직 못 세는 자리가 하나 있다.** `organization.verifyInviteCode`는 코드를 본문에
 * 싣는데 계약에는 본문 칸에 `x-secret`을 달 자리가 없다. 숨기지 않고 적어 둔다.
 */
function guarded(c: Context): boolean {
  return opensToAnyone(c) || carriesSecret(c)
}

export function guessRateLimit(deps: RateLimitDeps): MiddlewareHandler {
  const limits = deps.limits ?? DEFAULT_LIMITS
  const clock = deps.now ?? (() => Date.now())

  return async (c, next) => {
    if (!guarded(c)) return next()

    const now = clock()
    const address = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    // **토큰을 그대로 세지 않는다.** 세는 자리에 남으면 그것도 새는 길이다.
    const token = tokenOfRequest(c)
    const keys: Array<[string, Window]> = [[`ip:${address}`, limits.perAddress]]
    if (token !== null) keys.push([`token:${hashToken(token)}`, limits.perToken])

    for (const [key, window] of keys) {
      const seen = deps.counter.add(key, 1, window, now)
      if (seen.over) {
        c.header('Retry-After', retryAfter(seen.retryAfterMs))
        return c.json({ message: '잠시 뒤에 다시 시도해 주세요' }, 429)
      }
    }

    await next()

    // **틀린 시도를 더 무겁게 센다.** 새로고침과 열쇠를 넣어 보는 것은 다른 일이고,
    // 무게가 같으면 정상 사용자를 막지 않는 한도가 곧 공격자에게도 넉넉해진다.
    if (c.res.status === 404 || c.res.status === 401 || c.res.status === 403) {
      for (const [key, window] of keys) {
        deps.counter.add(key, limits.failureWeight - 1, window, now)
      }
    }
  }
}
