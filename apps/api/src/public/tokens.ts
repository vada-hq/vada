import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import { matchRoute } from '../authorize.ts'

// 주소가 실어 오는 열쇠.
//
// **로그인이 없는 자리에서는 이것이 유일한 벽이다.** QR 토큰과 영수증이 그렇고,
// 둘 다 남이 가지면 남의 것이 열린다. 그래서 세 가지를 지킨다.
//
// 1. **추측할 수 없다.** 128비트 난수 — 짧은 열쇠는 마구 넣어 보면 열린다.
// 2. **그대로 저장하지 않는다.** 표에는 해시만 둔다. 표가 새도 열쇠는 안 샌다 —
//    로그와 백업으로 새는 길이 표보다 넓다.
// 3. **오래 살지 않는다.** 오래 사는 열쇠는 오래 새는 열쇠다.

/** 128비트. base64url이라 22자다 — 사람이 주소창에서 보기에도 무리가 없다. */
export function newToken(): string {
  return randomBytes(16).toString('base64url')
}

/**
 * 표에 둘 모양.
 *
 * 소금을 치지 않는다 — 이 값들은 **높은 엔트로피의 난수**라 사전 공격이 없고,
 * 소금을 치면 들어온 값으로 찾을 수가 없다(찾는 것이 이 해시의 용도다).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

/**
 * 두 해시가 같은가. **길이가 같을 때만 시간이 일정하게 견준다.**
 *
 * 실은 여기서 새는 것이 크지 않다(해시끼리 견준다). 그래도 견주는 자리를 한 곳에
 * 두면 나중에 열쇠를 그대로 견주게 되는 실수를 막는다.
 */
export function sameToken(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * 들어온 값이 열쇠의 **모양**인가.
 *
 * 모양이 아닌 것은 표를 찾아보기도 전에 막는다 — 마구 넣어 보는 쪽에 드는 값을
 * 올리고, 이상한 값이 저장소까지 가지 않게 한다.
 */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value)
}

/**
 * 이 요청이 실어 온 열쇠.
 *
 * **어느 자리가 무엇을 싣는지는 계약이 안다.** 주소의 몇 번째 칸이라고 세면 자리마다
 * 모양이 달라 틀린다 — `check-in-form`처럼 토큰이 아닌 글자가 토큰 자리에 앉으면
 * 그 행사의 요청이 전부 한 칸에 몰린다.
 *
 * 모양이 아닌 값은 없는 것으로 본다. 그것을 세어 봐야 마구 넣어 보는 쪽이 칸만
 * 늘릴 뿐이고, 주소마다 세는 쪽이 그것을 막는다.
 */
export function tokenOfRequest(c: Context): string | null {
  for (const [name, value] of Object.entries(c.req.query())) {
    if (name.endsWith('Token') && looksLikeToken(value)) return value
  }
  const matched = matchRoute(c.req.method, c.req.path)
  if (matched === undefined) return null
  for (const [name, value] of Object.entries(matched.params)) {
    if (name.endsWith('Token') && looksLikeToken(value)) return value
  }
  return null
}
