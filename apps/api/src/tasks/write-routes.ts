import type { Context, Hono } from 'hono'
import {
  ChangeTaskStatusSchema,
  CreateTaskSchema,
  DeleteTaskSchema,
  NO_CONTENT,
  UpdateTaskSchema,
  type TaskResponse,
} from '@vada/contracts'
import { recordIdOf } from '../access/authorize.js'
import type { Actor } from '../access/actor.js'
import type { SessionEnv, requireSession } from '../auth/require-session.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { changeTaskStatus, createTask, deleteTask, updateTask } from './service.js'

const root = '/organizations/:councilId'
const CREATED = 201

// 만들기(와 조각 4의 맡기기)가 한도 하나를 같이 쓴다: 계정마다 10초에 20번(기능 003 보내기와 같은 값).
export const TASK_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }

export interface WriteKit {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  // 학생회 행을 잠그고 운영진인지 본 뒤 바꾸는 거래
  change: <T>(
    c: Context<SessionEnv>,
    run: (tx: Tx, actor: Actor, now: Date) => Promise<T>,
  ) => Promise<T>
}

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
const taskIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('taskId'))

export function addTaskWriteRoutes({ routes, auth, writeLimiter, clock, change }: WriteKit) {
  routes.post(`${root}/tasks`, json(CreateTaskSchema), auth, async c => {
    // 계정마다 센다. 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const input = c.req.valid('json')
    const task = await change(c, (tx, actor, now) => createTask(tx, actor, input, now))
    return c.json({ task } satisfies TaskResponse, CREATED)
  })
  routes.post(`${root}/tasks/:taskId`, json(UpdateTaskSchema), auth, async c => {
    const input = c.req.valid('json')
    const task = await change(c, (tx, actor, now) =>
      updateTask(tx, actor, { taskId: taskIdOf(c), now }, input),
    )
    return c.json({ task } satisfies TaskResponse)
  })
  routes.post(`${root}/tasks/:taskId/status`, json(ChangeTaskStatusSchema), auth, async c => {
    const input = c.req.valid('json')
    const task = await change(c, (tx, actor, now) =>
      changeTaskStatus(tx, actor, { taskId: taskIdOf(c), now }, input),
    )
    return c.json({ task } satisfies TaskResponse)
  })
  routes.post(`${root}/tasks/:taskId/delete`, json(DeleteTaskSchema), auth, async c => {
    await change(c, (tx, actor, now) => deleteTask(tx, actor, { taskId: taskIdOf(c), now }))
    return c.body(null, NO_CONTENT)
  })
}
