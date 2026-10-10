import { Hono, type Context } from 'hono'
import { ClosePeriodSchema, CreateBudgetPeriodSchema, ReopenPeriodSchema, SaveBudgetPlanSchema, token, type BudgetPeriodsResponse,
  type BudgetPlanResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { contentDisposition, XLSX_TYPE } from '../workbook/cells.js'
import { createBudgetService, type BudgetDatabase, type BudgetScope } from './service.js'
import { periodFileName, periodWorkbook } from './workbook.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 예산. 기간과 편성은 구성원 누구나 보고, 기간 만들기와 편성 수정은 재정 권한자만 한다.
// 결산서의 영수증 링크는 앱 주소(publicOrigin)로 만든다.
export function createBudgetRoutes(db: BudgetDatabase, session: SessionReader, publicOrigin: string) {
  const routes = new Hono<MembershipEnv>()
  const service = createBudgetService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/budget/periods'
  const scope = (c: Context<MembershipEnv>): BudgetScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  routes.get(base, auth, member, async c => c.json(await service.periods(scope(c)) satisfies BudgetPeriodsResponse))
  routes.post(base, json(CreateBudgetPeriodSchema), auth, member, async c =>
    c.json(await service.createPeriod(scope(c), c.req.valid('json')) satisfies BudgetPlanResponse, 201))
  routes.get(`${base}/:periodId`, auth, member, async c =>
    c.json(await service.plan(scope(c), idOf(c.req.param('periodId'))) satisfies BudgetPlanResponse))
  routes.post(`${base}/:periodId/plan`, json(SaveBudgetPlanSchema), auth, member, async c =>
    c.json(await service.savePlan(scope(c), idOf(c.req.param('periodId')), c.req.valid('json')) satisfies BudgetPlanResponse))
  // 기간 마감과 다시 열기. 재정 권한자만 한다.
  routes.post(`${base}/:periodId/close`, json(ClosePeriodSchema), auth, member, async c =>
    c.json(await service.close(scope(c), idOf(c.req.param('periodId')), c.req.valid('json')) satisfies BudgetPlanResponse))
  routes.post(`${base}/:periodId/reopen`, json(ReopenPeriodSchema), auth, member, async c =>
    c.json(await service.reopen(scope(c), idOf(c.req.param('periodId')), c.req.valid('json')) satisfies BudgetPlanResponse))
  // 결산서 엑셀. 구성원 누구나 내려받는다.
  routes.get(`${base}/:periodId/export`, auth, member, async c => {
    const data = await service.exportData(scope(c), idOf(c.req.param('periodId')), publicOrigin)
    const file = await periodWorkbook(data)
    c.header('Content-Type', XLSX_TYPE)
    c.header('Content-Disposition', contentDisposition(periodFileName(data.period.name, data.exportedAt)))
    c.header('Cache-Control', 'no-store')
    return c.body(new Uint8Array(file))
  })
  return routes
}
