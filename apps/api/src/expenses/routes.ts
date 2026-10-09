import { Hono, type Context } from 'hono'
import { CreateExpenseSchema, token, UpdateExpenseSchema, VoidExpenseSchema, type ExpenseDetail, type ExpenseResponse,
  type ExpensesResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createExpenseService, type ExpenseDatabase, type ExpenseScope } from './service.js'
import type { ReceiptStorage } from './storage.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 저장소가 없으면 영수증 올리기·보기만 막힌다(Task 5).
export function createExpenseRoutes(db: ExpenseDatabase, session: SessionReader, storage?: ReceiptStorage) {
  const routes = new Hono<MembershipEnv>()
  const service = createExpenseService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/expenses'
  const scope = (c: Context<MembershipEnv>): ExpenseScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const reply = (expense: ExpenseDetail) => ({ expense }) satisfies ExpenseResponse
  routes.get(base, auth, member, async c => c.json(await service.list(scope(c)) satisfies ExpensesResponse))
  routes.post(base, json(CreateExpenseSchema), auth, member, async c => c.json(reply(await service.create(scope(c), c.req.valid('json'))), 201))
  routes.get(`${base}/:expenseId`, auth, member, async c => c.json(reply(await service.get(scope(c), idOf(c.req.param('expenseId'))))))
  routes.patch(`${base}/:expenseId`, json(UpdateExpenseSchema), auth, member, async c =>
    c.json(reply(await service.update(scope(c), idOf(c.req.param('expenseId')), c.req.valid('json')))))
  routes.post(`${base}/:expenseId/void`, json(VoidExpenseSchema), auth, member, async c =>
    c.json(reply(await service.void(scope(c), idOf(c.req.param('expenseId')), c.req.valid('json')))))
  void storage
  return routes
}
