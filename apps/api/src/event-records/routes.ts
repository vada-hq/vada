import { Hono, type Context } from 'hono'
import type { EventRecordResponse, RecordEventsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db, Tx } from '../db/types.js'
import { eventRecordOf } from './detail.js'
import { eventRecordListOf } from './list.js'

const root = '/organizations/:councilId/records/events'

// 읽기는 한 시점의 모습이다(행사 읽기와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 기록 메뉴(DEC-110): 행사를 볼 수 있는 운영진(모든 운영진, council.view)이 본다. 쓰기는 없다.
export function createEventRecordRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  // 운영진인지 본 뒤 한 시점의 모습으로 읽는다. 번호 형식은 그 뒤에 본다(운영진이 아니면 대상이 있는지 드러내지 않는다).
  const read = <T>(
    c: Context<SessionEnv>,
    body: (tx: Tx, actor: Actor, now: Date) => Promise<T>,
  ) => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    return db.transaction(async tx => body(tx, await authorize(tx, request), request.now), snapshot)
  }
  routes.get(root, auth, async c =>
    c.json((await read(c, eventRecordListOf)) satisfies RecordEventsResponse),
  )
  routes.get(`${root}/:eventId`, auth, async c => {
    const record = await read(c, (tx, actor, now) =>
      eventRecordOf(tx, actor, recordIdOf(c.req.param('eventId')), now),
    )
    return c.json({ record } satisfies EventRecordResponse)
  })
  return routes
}
