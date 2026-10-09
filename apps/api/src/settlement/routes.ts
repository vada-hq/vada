import { Hono, type Context } from 'hono'
import { ReopenSettlementSchema, SetEventBudgetSchema, SettleEventSchema, token, type EventFinanceResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createSettlementService, type SettlementDatabase, type SettlementScope } from './service.js'
import { contentDisposition, settlementFileName, settlementWorkbook } from './workbook.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 행사 재정. 숫자·지출·처리 기록은 구성원 누구나 보고, 예산·정산·다시 열기는 재정 권한자만 한다.
export function createSettlementRoutes(db: SettlementDatabase, session: SessionReader, publicOrigin: string) {
  const routes = new Hono<MembershipEnv>()
  const service = createSettlementService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/events/:eventId/finance'
  const scope = (c: Context<MembershipEnv>): SettlementScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  routes.get(base, auth, member, async c => c.json(await service.get(scope(c), eventId(c)) satisfies EventFinanceResponse))
  routes.post(`${base}/budget`, json(SetEventBudgetSchema), auth, member, async c =>
    c.json(await service.setBudget(scope(c), eventId(c), c.req.valid('json')) satisfies EventFinanceResponse))
  routes.post(`${base}/settle`, json(SettleEventSchema), auth, member, async c =>
    c.json(await service.settle(scope(c), eventId(c), c.req.valid('json')) satisfies EventFinanceResponse))
  routes.post(`${base}/reopen`, json(ReopenSettlementSchema), auth, member, async c =>
    c.json(await service.reopen(scope(c), eventId(c), c.req.valid('json')) satisfies EventFinanceResponse))
  // 정산서 엑셀. 구성원 누구나 내려받는다. 영수증 링크는 앱 주소(publicOrigin)로 만든다.
  routes.get(`${base}/export`, auth, member, async c => {
    const data = await service.exportData(scope(c), eventId(c), publicOrigin)
    const file = await settlementWorkbook(data)
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    c.header('Content-Disposition', contentDisposition(settlementFileName(data.eventName, data.exportedAt)))
    c.header('Cache-Control', 'no-store')
    return c.body(new Uint8Array(file))
  })
  return routes
}
