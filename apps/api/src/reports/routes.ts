import { Hono, type Context } from 'hono'
import { token, type EventReportResponse, type RecordsResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
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
  return routes
}
