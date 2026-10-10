import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'

export const MAX_BODY_BYTES = 32768
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])
// 본문이 큰 경로. 상한은 여기 한 곳에서 정하고 라우트에서 다시 다루지 않는다.
// 학생회비 명단은 학번·이름 수천 줄을 한 번에 받는다.
const largeBodies: { pattern: RegExp; max: number }[] = [{ pattern: /^\/api\/organizations\/[^/]+\/dues-roster$/, max: 1_048_576 }]
export const bodyLimitOf = (path: string) => largeBodies.find(entry => entry.pattern.test(path))?.max ?? MAX_BODY_BYTES

// 본문을 끝까지 버퍼링하기 전에 크기를 제한한다. 출처 검사를 따로 하는 인증 경로에도 쓴다.
export const limitBody = (maxSize = MAX_BODY_BYTES) => bodyLimit({ maxSize, onError: c => c.json({ error: 'BODY_TOO_LARGE' }, 413) })

// 인증·DB 조회보다 먼저 실행한다. 새 라우트도 /api/organizations 아래면 자동 적용된다.
export function mutationGuard(trustedOrigin: string) {
  const origin = new URL(trustedOrigin).origin
  // 상한마다 미들웨어를 한 번만 만든다.
  const limiters = new Map<number, MiddlewareHandler>()
  const limiterOf = (max: number) => {
    let limiter = limiters.get(max)
    if (!limiter) limiters.set(max, limiter = limitBody(max))
    return limiter
  }
  return createMiddleware(async (c, next) => {
    if (readOnly.has(c.req.method)) return next()
    // 인증 쿠키를 사용하는 변경 요청은 프런트엔드의 동일 출처만 허용한다.
    if (c.req.header('Origin') !== origin) return c.json({ error: 'FORBIDDEN' }, 403)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415)
    }
    return limiterOf(bodyLimitOf(c.req.path))(c, next)
  })
}
