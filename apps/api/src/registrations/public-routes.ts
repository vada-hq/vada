import { Hono } from 'hono'
import {
  ApplySchema,
  TokenSchema,
  type ApplyResponse,
  type CancelRegistrationResponse,
  type MyRegistration,
  type PublicRegistrationForm,
} from '@vada/contracts'
import type { Db } from '../db/types.js'
import { json } from '../http/validate.js'
import { applyToForm } from './apply.js'
import { cancelMine } from './cancel-mine.js'
import { lookupMine } from './my-registration.js'
import { publicFormOf } from './public-form.js'

const CREATED = 201

// 읽기는 한 시점의 모습이다(신청 수와 양식이 같은 순간 것).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 로그인 없이 쓰는 공개 경로(/api/public/). 학생회 경계는 코드와 개인 링크 토큰으로만 가른다. 속도 제한은 두지 않는다(기능 007 '속도 제한').
// 토큰은 경로에 넣지 않고 본문으로 받는다(주소는 로그에 남는다). 공개 응답은 모두 no-store다: 정원, 상태, 개인정보가 중간 캐시나 뒤로 가기에 남지 않게 한다.
export function createPublicRegistrationRoutes(db: Db, options: { clock?: () => Date } = {}) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono()
  routes.use('/public/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })
  routes.get('/public/registration-forms/:code', async c => {
    const now = clock()
    const form = await db.transaction(
      async tx => publicFormOf(tx, c.req.param('code'), now),
      snapshot,
    )
    return c.json(form satisfies PublicRegistrationForm)
  })
  routes.post('/public/registration-forms/:code/apply', json(ApplySchema), async c => {
    const input = c.req.valid('json')
    const now = clock()
    const done = await db.transaction(tx =>
      applyToForm(tx, { code: c.req.param('code'), now }, input),
    )
    return c.json(done satisfies ApplyResponse, CREATED)
  })
  routes.post('/public/registrations/lookup', json(TokenSchema), async c => {
    const { token } = c.req.valid('json')
    const now = clock()
    const mine = await db.transaction(async tx => lookupMine(tx, token, now), snapshot)
    return c.json(mine satisfies MyRegistration)
  })
  routes.post('/public/registrations/cancel', json(TokenSchema), async c => {
    const { token } = c.req.valid('json')
    const now = clock()
    await db.transaction(tx => cancelMine(tx, token, now))
    return c.json({ cancelled: true } satisfies CancelRegistrationResponse)
  })
  return routes
}
