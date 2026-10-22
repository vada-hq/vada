import { createMiddleware } from 'hono/factory'
import { CURRENT_TERMS, isTermsRequired, type Terms } from '@vada/contracts'
import type { SessionReader } from '../auth/require-session.js'
import { errorResponse } from '../http/errors.js'

type HasAgreed = (userId: string, terms: Terms) => Promise<boolean>

// 지금 판에 동의하지 않은 사람의 학생회 요청을 막는다(DEC-51: 화면만 막으면 API로 우회된다). 접두어에 한 번 걸어, 새 경로도 저절로 막힌다.
// 로그인하지 않은 요청은 그대로 보내 각 경로의 인증이 401로 답하게 한다. 동의할 약관이 없는 동안(주소 상수가 비었을 때)은 아무것도 읽지 않고 지나간다.
export function termsGate(
  getSession: SessionReader,
  hasAgreed: HasAgreed,
  terms: Terms = CURRENT_TERMS,
) {
  return createMiddleware(async (c, next) => {
    if (!isTermsRequired(terms)) return next()
    const session = await getSession(c.req.raw.headers)
    if (session && !(await hasAgreed(session.user.id, terms))) {
      c.header('Cache-Control', 'no-store')
      return errorResponse(c, 'TERMS_REQUIRED')
    }
    return next()
  })
}
