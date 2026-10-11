import { Hono, type Context } from 'hono'
import { PublishEventReportSchema, SaveEventReportSchema, token, UnpublishEventReportSchema, type EventReportResponse,
  type RecordsResponse } from '@vada/contracts'
import { requireEventManager, requireMembership, requireOrganizationManager, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createReportService, type ReportDatabase, type ReportScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 행사로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 기록(완료한 행사)과 결과보고서(M5b). 구성원 누구나 본다.
export function createReportRoutes(db: ReportDatabase, session: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const service = createReportService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/events/:eventId/report'
  const scope = (c: Context<MembershipEnv>): ReportScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  routes.get('/organizations/:organizationId/records', auth, member, async c => c.json(await service.records(scope(c)) satisfies RecordsResponse))
  routes.get(base, auth, member, async c => c.json(await service.get(scope(c), eventId(c)) satisfies EventReportResponse))
  // 쓰기는 부서가 있는 구성원, 발행·발행 취소는 회장단이다. 모두 완료한 행사에서만 된다.
  const writer = requireEventManager()
  const leader = requireOrganizationManager()
  routes.post(base, json(SaveEventReportSchema), auth, member, writer, async c =>
    c.json(await service.save(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  routes.post(`${base}/publish`, json(PublishEventReportSchema), auth, member, leader, async c =>
    c.json(await service.publish(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  routes.post(`${base}/unpublish`, json(UnpublishEventReportSchema), auth, member, leader, async c =>
    c.json(await service.unpublish(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  return routes
}
