import { Hono, type Context } from 'hono'
import {
  TaskListQuerySchema,
  type TaskListQuery,
  type TaskResponse,
  type TasksResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import type { Actor } from '../access/actor.js'
import type { Db, Tx } from '../db/types.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { taskDetailOf, taskListOf } from './queries.js'
import { addTaskWriteRoutes, TASK_WRITE_LIMIT } from './write-routes.js'

const root = '/organizations/:councilId'

// 읽기는 한 시점의 모습이다. 권한 확인과 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 한다(chat 읽기와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 같은 키를 두 번 준 쿼리는 어느 값을 쓸지 정할 수 없어 400이다.
function listQueryOf(c: Context<SessionEnv>): TaskListQuery {
  const entries = Object.entries(c.req.queries())
  if (entries.some(([, values]) => values.length !== 1)) throw new ApiError('INVALID_INPUT')
  const parsed = TaskListQuerySchema.safeParse(
    Object.fromEntries(entries.map(([key, values]) => [key, values[0]])),
  )
  if (!parsed.success) throw new ApiError('INVALID_INPUT')
  return parsed.data
}

// 학생회 행을 잠그고 운영진인지 본 뒤 바꾸는 거래. 권한표는 업무를 읽은 뒤 서비스가 묻는다.
function changeIn<T>(
  db: Db,
  clock: () => Date,
  c: Context<SessionEnv>,
  run: (tx: Tx, actor: Actor, now: Date) => Promise<T>,
) {
  const now = clock()
  return inCouncilChange(
    db,
    { userId: c.get('userId'), councilId: c.req.param('councilId'), action: 'council.view', now },
    (tx, actor) => run(tx, actor, now),
  )
}

// 업무: 모든 운영진이 본다(DEC-28 기준 1, PRIN-5). 쓰기는 write-routes.ts다.
export function createTaskRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: councilIdOf(c.req.param('councilId')),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.get(`${root}/tasks`, auth, async c => {
    const request = asked(c)
    const query = listQueryOf(c)
    const list = await db.transaction(
      async tx => taskListOf(tx, await authorize(tx, request), query, request.now),
      snapshot,
    )
    return c.json(list satisfies TasksResponse)
  })
  routes.get(`${root}/tasks/:taskId`, auth, async c => {
    const request = asked(c)
    const taskId = recordIdOf(c.req.param('taskId'))
    const detail = await db.transaction(
      async tx => taskDetailOf(tx, await authorize(tx, request), taskId, request.now),
      snapshot,
    )
    return c.json({ task: detail } satisfies TaskResponse)
  })
  addTaskWriteRoutes({
    routes,
    auth,
    clock,
    writeLimiter: options.writeLimiter ?? createRateLimiter(TASK_WRITE_LIMIT),
    change: (c, run) => changeIn(db, clock, c, run),
  })
  return routes
}
