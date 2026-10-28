import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import { errorResponse } from './errors.js'

export const MAX_BODY_BYTES = 32768
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])
// 본문이 큰 경로. 상한은 여기 한 곳에서 정하고 라우트에서 다시 다루지 않는다.
// 구매 요청의 가장 큰 본문: 품목 한 줄은 이름 100자와 옵션 200자가 제어 문자(JSON에서 6바이트)이고 링크 2000자가 한글 같은 3바이트 글자이면
// (100+200)*6 + 2000*3 = 7,800바이트에 키 이름이 약 60바이트다. 20줄이면 약 157KB이고, 제목 100자와 내용 1000자가 6바이트이면 6.6KB가 더해져 약 164KB다.
// 그래서 192 KiB(196,608)로 둔다. 시험(purchases/write.test.ts)이 이 최대 입력이 413 없이 받아지는지 본다.
// 회의 만들기: 안건 30개가 제목 100자·설명 500자를 제어 문자로 채우면 30*(600*6+40) = 109,200바이트이고, 회의 칸 700자*6과
// 참가자 200명(uuid 39바이트)이 약 12KB를 더해 약 122KB다. 그래서 128 KiB로 둔다(meetings/write.test.ts가 본다).
// 학생회비 명단은 학번·이름 수천 줄을 한 번에 받는다. 회고 저장(M5c)은 200자 30문장까지이고, 제어 문자는 JSON에서 6바이트가 된다.
const largeBodies: { pattern: RegExp; max: number }[] = [
  { pattern: /^\/api\/organizations\/[^/]+\/fee-payments$/, max: 1_048_576 },
  { pattern: /^\/api\/organizations\/[^/]+\/purchase-requests$/, max: 196_608 },
  { pattern: /^\/api\/organizations\/[^/]+\/events\/[^/]+\/report\/retrospective$/, max: 65_536 },
  { pattern: /^\/api\/organizations\/[^/]+\/meetings$/, max: 131_072 },
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
