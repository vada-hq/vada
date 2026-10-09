import { Hono, type Context } from 'hono'
import { CreateIncomeSchema, token, UpdateIncomeSchema, VoidIncomeSchema, type IncomeDetail, type IncomeResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createIncomeService, type IncomeDatabase, type IncomeScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 실제 수입. 구성원 누구나 보고, 기록·수정·취소는 재정 권한자만 한다. 수입은 회계 기간 하나에 속한다.
export function createIncomeRoutes(db: IncomeDatabase, session: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const service = createIncomeService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/budget/periods/:periodId/incomes'
  const scope = (c: Context<MembershipEnv>): IncomeScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const periodId = (c: Context<MembershipEnv>) => idOf(c.req.param('periodId'))
  const incomeId = (c: Context<MembershipEnv>) => idOf(c.req.param('incomeId'))
  const reply = (income: IncomeDetail) => ({ income }) satisfies IncomeResponse
  routes.post(base, json(CreateIncomeSchema), auth, member, async c => c.json(reply(await service.create(scope(c), periodId(c), c.req.valid('json'))), 201))
  routes.get(`${base}/:incomeId`, auth, member, async c => c.json(reply(await service.get(scope(c), periodId(c), incomeId(c)))))
  routes.patch(`${base}/:incomeId`, json(UpdateIncomeSchema), auth, member, async c =>
    c.json(reply(await service.update(scope(c), periodId(c), incomeId(c), c.req.valid('json')))))
  routes.post(`${base}/:incomeId/void`, json(VoidIncomeSchema), auth, member, async c =>
    c.json(reply(await service.void(scope(c), periodId(c), incomeId(c), c.req.valid('json')))))
  return routes
}
