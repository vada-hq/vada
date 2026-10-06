import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ApiError } from './errors.js'

// DB 오류는 drizzle이 감싸므로 cause를 몇 단계 따라가 SQLSTATE만 꺼낸다.
function sqlState(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; current && typeof current === 'object' && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

// 오류 메시지·요청 본문·경로 값은 비밀이나 개인정보를 담을 수 있어 남기지 않는다.
function logFailure(c: Context, fields: Record<string, unknown>) {
  console.error(JSON.stringify({ event: 'request_failed', method: c.req.method, route: c.req.routePath, ...fields }))
}

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) {
    // 외부 서비스 장애처럼 서버 쪽 실패는 운영에서 보이도록 코드와 상태를 남긴다.
    if (error.status >= 500) logFailure(c, { code: error.code, status: error.status })
    return c.json({ error: error.code }, error.status)
  }
  if (error instanceof HTTPException) {
    if (error.status >= 500) logFailure(c, { status: error.status })
    return c.json({ error: error.status === 400 ? 'INVALID_INPUT' : 'REQUEST_FAILED' }, error.status)
  }
  logFailure(c, { error: error.name, sqlState: sqlState(error) })
  return c.json({ error: 'Internal server error' }, 500)
}
