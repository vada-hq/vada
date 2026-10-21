import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import { errorResponse } from './errors.js'

export const MAX_BODY_BYTES = 32768
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])
// 본문이 큰 경로. 상한은 여기 한 곳에서 정하고 라우트에서 다시 다루지 않는다.
// 구매 요청은 품목 20줄(이름 100, 링크 2000, 옵션 200자)이라 제어 문자가 한 글자 6바이트가 되는 가장 나쁜 경우에도 84KB 안이다.
// 학생회비 명단은 학번·이름 수천 줄을 한 번에 받는다. 회고 저장(M5c)은 200자 30문장까지이고, 제어 문자는 JSON에서 6바이트가 된다.
const largeBodies: { pattern: RegExp; max: number }[] = [
  { pattern: /^\/api\/organizations\/[^/]+\/dues-roster$/, max: 1_048_576 },
  { pattern: /^\/api\/organizations\/[^/]+\/purchase-requests$/, max: 98_304 },
  { pattern: /^\/api\/organizations\/[^/]+\/events\/[^/]+\/report\/retrospective$/, max: 65_536 },
]
export const bodyLimitOf = (path: string) =>
  largeBodies.find(entry => entry.pattern.test(path))?.max ?? MAX_BODY_BYTES

// 본문을 끝까지 버퍼링하기 전에 크기를 제한한다. 출처 검사를 따로 하는 인증 경로에도 쓴다.
export const limitBody = (maxSize = MAX_BODY_BYTES) =>
  bodyLimit({ maxSize, onError: c => errorResponse(c, 'BODY_TOO_LARGE') })

// 인증·DB 조회보다 먼저 실행한다. 새 라우트도 /api/organizations 아래면 자동 적용된다.
export function mutationGuard(trustedOrigin: string) {
  const origin = new URL(trustedOrigin).origin
  // 상한마다 미들웨어를 한 번만 만든다.
  const limiters = new Map<number, MiddlewareHandler>()
  const limiterOf = (max: number) => {
    let limiter = limiters.get(max)
    if (!limiter) limiters.set(max, (limiter = limitBody(max)))
    return limiter
  }
  return createMiddleware(async (c, next) => {
    if (readOnly.has(c.req.method)) return next()
    // 인증 쿠키를 사용하는 변경 요청은 프런트엔드의 동일 출처만 허용한다.
    if (c.req.header('Origin') !== origin) return errorResponse(c, 'FORBIDDEN')
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return errorResponse(c, 'UNSUPPORTED_MEDIA_TYPE')
    }
    return limiterOf(bodyLimitOf(c.req.path))(c, next)
  })
}
