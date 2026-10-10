import { Hono, type Context } from 'hono'
import { DeleteDuesRosterSchema, ReplaceDuesRosterSchema, SetFeeAccountSchema, type FeeSettingsResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import { createFeeService, type FeeDatabase, type FeeScope } from './service.js'

// 참가비 설정: 학생회 계좌와 학생회비 납부 명단. 재정 권한은 서비스가 잠금과 함께 본다.
// 명단 본문은 학번·이름 수천 줄이라 공통 가드가 이 경로만 크게 받는다(guard.ts의 bodyLimitOf).
export function createFeeRoutes(db: FeeDatabase, session: SessionReader, { now = () => new Date() }: { now?: () => Date } = {}) {
  const routes = new Hono<MembershipEnv>()
  const service = createFeeService(db, now)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId'
  const scope = (c: Context<MembershipEnv>): FeeScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const reply = (body: FeeSettingsResponse) => body
  routes.get(`${base}/fee-settings`, auth, member, async c => c.json(reply(await service.settings(scope(c)))))
  routes.post(`${base}/fee-account`, json(SetFeeAccountSchema), auth, member, async c =>
    c.json(reply(await service.setAccount(scope(c), c.req.valid('json')))))
  routes.post(`${base}/dues-roster`, json(ReplaceDuesRosterSchema), auth, member, async c =>
    c.json(reply(await service.replaceRoster(scope(c), c.req.valid('json')))))
  routes.post(`${base}/dues-roster/delete`, json(DeleteDuesRosterSchema), auth, member, async c =>
    c.json(reply(await service.deleteRoster(scope(c), c.req.valid('json')))))
  return routes
}
