import { Hono, type Context } from 'hono'
import {
  CreateCouncilSchema,
  UpdateCohortSchema,
  UpdateCouncilSettingsSchema,
  type Action,
  type CouncilView,
  type CreateCouncilRequest,
  type CreateCouncilResponse,
  type MyCouncilsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, councilIdOf, inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { CREATED } from '../http/status.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../db/types.js'
import { councilView, myCouncils } from './queries.js'
import { createCouncil, updateCohort, updateSettings } from './service.js'

type Change = (
  c: Context<SessionEnv>,
  action: Action,
  run: (tx: Tx, actor: Actor, now: Date) => Promise<void>,
) => Promise<Response>

// 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 학생회를 돌려준다.
const changeOf =
  (db: Db, clock: () => Date): Change =>
  async (c, action, run) => {
    const now = clock()
    const request = { userId: c.get('userId'), councilId: c.req.param('councilId'), action, now }
    const view = await inCouncilChange(db, request, async (tx, actor) => {
      await run(tx, actor, now)
      return councilView(tx, actor)
    })
    return c.json(view satisfies CouncilView)
  }

// 응답도 같은 거래 안에서 만든다. 커밋한 뒤에 읽다가 실패하면 학생회는 만들어졌는데 요청은 500이 된다.
async function createdCouncil(db: Db, userId: string, input: CreateCouncilRequest, now: Date) {
  return db.transaction(async tx => {
    const councilId = await createCouncil(tx, userId, input, now)
    const created = (await myCouncils(tx, userId, now)).find(item => item.id === councilId)
    if (!created) throw new Error('Council missing after create')
    return created
  })
}

// 학생회: 내 학생회 목록, 만들기, 학생회 하나 보기, 설정, 기수. clock은 시험에서 오늘을 정할 때만 바꾼다.
export function createCouncilRoutes(
  db: Db,
  getSession: SessionReader,
  clock: () => Date = () => new Date(),
) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const change = changeOf(db, clock)

  routes.get('/me/councils', auth, async c =>
    c.json({
      councils: await myCouncils(db, c.get('userId'), clock()),
    } satisfies MyCouncilsResponse),
  )
  routes.post('/organizations/create', json(CreateCouncilSchema), auth, async c => {
    const council = await createdCouncil(db, c.get('userId'), c.req.valid('json'), clock())
    return c.json({ council } satisfies CreateCouncilResponse, CREATED)
  })
  routes.get('/organizations/:councilId', auth, async c => {
    const actor = await authorize(db, {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view',
      now: clock(),
    })
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
