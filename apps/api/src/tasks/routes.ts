import { Hono, type Context } from 'hono'
import { ChangeTaskStatusSchema, CreateTaskSchema, DeleteTaskSchema, token, UpdateTaskSchema, type EventTasksResponse, type MyTasksResponse,
  type TaskDetail, type TaskResponse } from '@vada/contracts'
import { requireEventManager, requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createTaskService, type TaskDatabase, type TaskScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 행사 업무. 구성원 누구나 보고, 부서가 있는 구성원이 만들고 바꾼다.
export function createTaskRoutes(db: TaskDatabase, session: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const service = createTaskService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const manager = requireEventManager()
  const base = '/organizations/:organizationId/events/:eventId/tasks'
  const scope = (c: Context<MembershipEnv>): TaskScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  const taskId = (c: Context<MembershipEnv>) => idOf(c.req.param('taskId'))
  const reply = (task: TaskDetail) => ({ task }) satisfies TaskResponse
  routes.get('/organizations/:organizationId/my-tasks', auth, member, async c => c.json(await service.mine(scope(c)) satisfies MyTasksResponse))
  routes.get(base, auth, member, async c => c.json(await service.list(scope(c), eventId(c)) satisfies EventTasksResponse))
  routes.post(base, json(CreateTaskSchema), auth, member, manager, async c =>
    c.json(reply(await service.create(scope(c), eventId(c), c.req.valid('json'))), 201))
  routes.get(`${base}/:taskId`, auth, member, async c => c.json(reply(await service.get(scope(c), eventId(c), taskId(c)))))
  routes.patch(`${base}/:taskId`, json(UpdateTaskSchema), auth, member, manager, async c =>
    c.json(reply(await service.update(scope(c), eventId(c), taskId(c), c.req.valid('json')))))
  routes.post(`${base}/:taskId/status`, json(ChangeTaskStatusSchema), auth, member, manager, async c =>
    c.json(reply(await service.changeStatus(scope(c), eventId(c), taskId(c), c.req.valid('json')))))
  routes.post(`${base}/:taskId/delete`, json(DeleteTaskSchema), auth, member, manager, async c =>
    c.json(await service.remove(scope(c), eventId(c), taskId(c), c.req.valid('json')) satisfies EventTasksResponse))
  return routes
}
