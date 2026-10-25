import type { Context } from 'hono'
import { deleteCookie, getCookie } from 'hono/cookie'

const MS_PER_HOUR = 3_600_000
const HOURS_PER_DAY = 24
// 되돌릴 수 없는 일은 로그인한 지 이만큼 안에만 한다(better-auth freshAge 기본 1일, GitHub sudo mode). 기능 021 정한 것 6.
const FRESH_MS = HOURS_PER_DAY * MS_PER_HOUR

// 세션을 만든 시각이 없거나 읽을 수 없으면 오래된 것으로 본다(기본 거부). 시계가 조금 어긋나 앞선 시각이면 새것이다.
export function isFreshSession(session: { createdAt: Date } | undefined, now: Date) {
  const createdAt = session ? new Date(session.createdAt).getTime() : Number.NaN
  return Number.isFinite(createdAt) && now.getTime() - createdAt <= FRESH_MS
}

// better-auth의 로그인 쿠키(기본 앞글자 better-auth., https에서는 __Secure-가 붙는다)를 모두 지운다.
// 세션 줄은 이미 지웠으므로 쿠키가 남아도 로그인되지 않지만, 브라우저에 쓸모없는 값을 남기지 않는다.
const LOGIN_COOKIE = /^(__Secure-)?better-auth\./

export function expireLoginCookies(c: Context) {
  for (const name of Object.keys(getCookie(c)).filter(item => LOGIN_COOKIE.test(item)))
    deleteCookie(c, name, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: name.startsWith('__Secure-'),
    })
}
