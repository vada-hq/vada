import { Hono, type Context } from 'hono'
import { ConfirmRetrospectiveSchema, GenerateRetrospectiveSchema, SaveRetrospectiveSchema, token, type EventReportResponse,
  type RecordsResponse } from '@vada/contracts'
import { requireEventManager, requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import type { RetrospectiveGenerator } from './generation.js'
import { createReportService, type ReportDatabase, type ReportScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 행사로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 기록(완료한 행사)과 결과보고서(M5b·M5c). 구성원 누구나 본다.
// 회고는 부서가 있는 구성원이 완료한 행사에서 만들고 고치고 확인한다(서비스가 requireCompletedEvent로 막는다).
export function createReportRoutes(db: ReportDatabase, session: SessionReader, generate: RetrospectiveGenerator) {
  const routes = new Hono<MembershipEnv>()
  const service = createReportService(db, generate)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const writer = requireEventManager()
  const base = '/organizations/:organizationId/events/:eventId/report'
  const scope = (c: Context<MembershipEnv>): ReportScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  routes.get('/organizations/:organizationId/records', auth, member, async c => c.json(await service.records(scope(c)) satisfies RecordsResponse))
  routes.get(base, auth, member, async c => c.json(await service.get(scope(c), eventId(c)) satisfies EventReportResponse))
  routes.post(`${base}/retrospective/generate`, json(GenerateRetrospectiveSchema), auth, member, writer, async c =>
    c.json(await service.generate(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  routes.post(`${base}/retrospective`, json(SaveRetrospectiveSchema), auth, member, writer, async c =>
    c.json(await service.save(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  routes.post(`${base}/retrospective/confirm`, json(ConfirmRetrospectiveSchema), auth, member, writer, async c =>
    c.json(await service.confirm(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  return routes
}
