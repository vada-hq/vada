import { Hono, type Context } from 'hono'
import { CreateExpenseSchema, CreateReceiptUploadSchema, ReceiptActionSchema, token, UpdateExpenseSchema, VoidExpenseSchema,
  type ExpenseDetail, type ExpenseResponse, type ReceiptUploadResponse,
  type ExpensesResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createReceiptService } from './receipts.js'
import { createExpenseService, type ExpenseDatabase, type ExpenseScope } from './service.js'
import type { ReceiptStorage } from './storage.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 저장소가 없으면 영수증 올리기·보기만 막힌다.
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
  const receipts = createReceiptService(db, storage)
  const receiptBase = `${base}/:expenseId/receipts`
  const ids = (c: Context<MembershipEnv>) => [idOf(c.req.param('expenseId')), idOf(c.req.param('receiptId'))] as const
  routes.post(receiptBase, json(CreateReceiptUploadSchema), auth, member, async c =>
    c.json(await receipts.createUpload(scope(c), idOf(c.req.param('expenseId')), c.req.valid('json')) satisfies ReceiptUploadResponse, 201))
  routes.post(`${receiptBase}/:receiptId/confirm`, json(ReceiptActionSchema), auth, member, async c =>
    c.json(reply(await receipts.confirm(scope(c), ...ids(c)))))
  routes.post(`${receiptBase}/:receiptId/delete`, json(ReceiptActionSchema), auth, member, async c =>
    c.json(reply(await receipts.remove(scope(c), ...ids(c)))))
  routes.get(`${receiptBase}/:receiptId/file`, auth, member, async c => {
    const url = await receipts.fileUrl(scope(c), ...ids(c))
    c.header('Cache-Control', 'no-store')
    return c.redirect(url, 302)
  })
  return routes
}
