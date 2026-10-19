import { Hono } from 'hono'
import { CreateCouncilSchema, type CouncilView, type CreateCouncilResponse, type MyCouncilsResponse } from '@vada/contracts'
import { authorize, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db } from '../records/records.js'
import { councilView, myCouncils } from './queries.js'
import { createCouncil } from './service.js'

// 학생회: 내 학생회 목록, 만들기, 학생회 하나 보기. clock은 시험에서 오늘을 정할 때만 바꾼다.
export function createCouncilRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)

  routes.get('/me/councils', auth, async c => c.json({ councils: await myCouncils(db, c.get('userId'), clock()) } satisfies MyCouncilsResponse))
  routes.post('/organizations/create', json(CreateCouncilSchema), auth, async c => {
    const now = clock()
    const userId = c.get('userId')
    // 응답도 같은 거래 안에서 만든다. 커밋한 뒤에 읽다가 실패하면 학생회는 만들어졌는데 요청은 500이 된다.
    const council = await db.transaction(async tx => {
      const councilId = await createCouncil(tx, userId, c.req.valid('json'), now)
      const created = (await myCouncils(tx, userId, now)).find(item => item.id === councilId)
      if (!created) throw new Error('Council missing after create')
      return created
    })
    return c.json({ council } satisfies CreateCouncilResponse, 201)
  })
  routes.get('/organizations/:councilId', auth, async c => {
    const actor = await authorize(db, c.get('userId'), councilIdOf(c.req.param('councilId')), 'council.view', clock())
    return c.json(await councilView(db, actor) satisfies CouncilView)
  })
  return routes
}
