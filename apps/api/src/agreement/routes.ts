import { Hono } from 'hono'
import { AgreeSchema, CURRENT_TERMS, isTermsRequired, type Terms } from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { termsGate } from './gate.js'
import { agreementOf, hasAgreed, recordAgreement } from './service.js'

// 가입 동의(DEC-51). 로그인한 사람 자신의 것이라 /me 아래에 두고 동의 전에도 열려 있다.
function createAgreementRoutes(db: Db, getSession: SessionReader, terms: Terms = CURRENT_TERMS) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  routes.get('/me/agreement', auth, async c =>
    c.json(await agreementOf(db, c.get('userId'), terms)),
  )
  routes.post('/me/agreement', json(AgreeSchema), auth, async c => {
    const userId = c.get('userId')
    // 동의할 약관이 없는 동안에는 아무것도 남기지 않는다.
    if (isTermsRequired(terms)) {
      const sent = c.req.valid('json')
      // 보여 준 뒤 판이 바뀌었거나 모르는 판이면 새 판을 다시 읽게 한다.
      if (sent.termsVersion !== terms.termsVersion || sent.privacyVersion !== terms.privacyVersion)
        throw new ApiError('TERMS_OUTDATED')
      await recordAgreement(db, userId, terms)
    }
    return c.json(await agreementOf(db, userId, terms))
  })
  return routes
}

// 경로와 막기를 한 쌍으로 만든다. 막기만 빼고 연결하는 일이 없도록 앱에는 이 쌍으로만 넘긴다.
export function createAgreement(db: Db, getSession: SessionReader, terms: Terms = CURRENT_TERMS) {
  return {
    routes: createAgreementRoutes(db, getSession, terms),
    gate: termsGate(getSession, (userId, current) => hasAgreed(db, userId, current), terms),
  }
}
