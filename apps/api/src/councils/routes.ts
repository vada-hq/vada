import { Hono, type Context } from 'hono'
import {
  CreateCouncilSchema,
  UpdateCohortSchema,
  UpdateCouncilSettingsSchema,
  type Action,
  type CouncilView,
  type CreateCouncilResponse,
  type MyCouncilsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, authorizeChange, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../records/records.js'
import { councilView, myCouncils } from './queries.js'
import { createCouncil, updateCohort, updateSettings } from './service.js'

// 학생회: 내 학생회 목록, 만들기, 학생회 하나 보기, 설정, 기수. clock은 시험에서 오늘을 정할 때만 바꾼다.
export function createCouncilRoutes(
  db: Db,
  getSession: SessionReader,
  clock: () => Date = () => new Date(),
) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)

  // 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 학생회를 돌려준다.
  async function change(
    c: Context<SessionEnv>,
    action: Action,
    run: (tx: Tx, actor: Actor, now: Date) => Promise<void>,
  ) {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    const view = await db.transaction(async tx => {
      const actor = await authorizeChange(tx, userId, councilId, action, now)
      await run(tx, actor, now)
      return councilView(tx, actor)
    })
    return c.json(view satisfies CouncilView)
  }

  routes.get('/me/councils', auth, async c =>
    c.json({
      councils: await myCouncils(db, c.get('userId'), clock()),
    } satisfies MyCouncilsResponse),
  )
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
    const actor = await authorize(
      db,
      c.get('userId'),
      councilIdOf(c.req.param('councilId')),
      'council.view',
      clock(),
    )
    return c.json((await councilView(db, actor)) satisfies CouncilView)
  })
  routes.post('/organizations/:councilId/settings', json(UpdateCouncilSettingsSchema), auth, c =>
    change(c, 'council.update', (tx, actor) => updateSettings(tx, actor, c.req.valid('json'))),
  )
  routes.post('/organizations/:councilId/cohort', json(UpdateCohortSchema), auth, c =>
    change(c, 'cohort.update', (tx, actor, now) =>
      updateCohort(tx, actor, c.req.valid('json'), now),
    ),
  )
  return routes
}
