import { Hono, type Context } from 'hono'
import { CancelRegistrationSchema, CreateRegistrationFormSchema, token, UpdateRegistrationFormSchema, type RegistrationResponse } from '@vada/contracts'
import { requireEventManager, requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createRegistrationService, type RegistrationDatabase, type RegistrationScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 행사 참가 신청. 신청자 정보가 있으므로 부서가 있는 구성원만 설정을 바꾸고 명단을 본다.
export function createRegistrationRoutes(db: RegistrationDatabase, session: SessionReader, { now = () => new Date() }: { now?: () => Date } = {}) {
  const routes = new Hono<MembershipEnv>()
  const service = createRegistrationService(db, now)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const manager = requireEventManager()
  const base = '/organizations/:organizationId/events/:eventId/registration'
  const scope = (c: Context<MembershipEnv>): RegistrationScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  const reply = (body: RegistrationResponse) => body
  routes.get(base, auth, member, manager, async c => c.json(reply(await service.view(scope(c).organizationId, eventId(c)))))
  routes.post(base, json(CreateRegistrationFormSchema), auth, member, manager, async c =>
    c.json(reply(await service.create(scope(c), eventId(c), c.req.valid('json'))), 201))
  routes.patch(base, json(UpdateRegistrationFormSchema), auth, member, manager, async c =>
    c.json(reply(await service.update(scope(c), eventId(c), c.req.valid('json')))))
  routes.post(`${base}/entries/:registrationId/cancel`, json(CancelRegistrationSchema), auth, member, manager, async c =>
    c.json(reply(await service.cancel(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  return routes
}
