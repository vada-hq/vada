import { Hono } from 'hono'
import { UpdateMeProfileSchema, type MeProfileResponse } from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db } from '../db/types.js'
import { myName, renameMe } from './service.js'

// 내 이름(로그인에 이어진 운영진의 이름) 읽기와 고치기. 학생회가 아니라 로그인한 사람 자신의 것이라 /api/me/ 아래다.
// 고친 뒤 응답은 같은 거래 안에서 읽는다.
export function createProfileRoutes(db: Db, getSession: SessionReader) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  routes.get('/me/profile', auth, async c =>
    c.json({ name: await myName(db, c.get('userId')) } satisfies MeProfileResponse),
  )
  routes.post('/me/profile', json(UpdateMeProfileSchema), auth, async c => {
    const userId = c.get('userId')
    const name = await db.transaction(async tx => {
      await renameMe(tx, userId, c.req.valid('json').name)
      return myName(tx, userId)
    })
    return c.json({ name } satisfies MeProfileResponse)
  })
  return routes
}
