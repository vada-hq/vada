import { Hono } from 'hono'
import {
  BudgetQuerySchema,
  CreateBudgetItemSchema,
  CreateFiscalPeriodSchema,
  type BudgetResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { budgetOf } from './queries.js'
import { addBudgetItem, createFiscalPeriod } from './service.js'

const root = '/organizations/:councilId'
const CREATED = 201

// 읽기는 한 시점의 모습이다(업무와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 회계 기간과 지출 예산 항목. 모든 운영진이 보고(PRIN-5), 만드는 것은 재정부만이다.
export function createBudgetRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (userId: string, councilId: string | undefined, now: Date) => ({
    userId,
    councilId: councilIdOf(councilId),
    action: 'council.view' as const,
    now,
  })
  routes.get(`${root}/budget`, auth, async c => {
    const now = clock()
    const request = asked(c.get('userId'), c.req.param('councilId'), now)
    const { period } = parseQuery(BudgetQuerySchema, c.req.queries())
    const view = await db.transaction(
      async tx => budgetOf(tx, await authorize(tx, request), now, period),
      snapshot,
    )
    return c.json(view satisfies BudgetResponse)
  })
  routes.post(`${root}/fiscal-periods`, json(CreateFiscalPeriodSchema), auth, async c => {
    const input = c.req.valid('json')
    const now = clock()
    const view = await inCouncilChange(
      db,
      asked(c.get('userId'), c.req.param('councilId'), now),
      (tx, actor) => createFiscalPeriod(tx, actor, input),
    )
    return c.json(view satisfies BudgetResponse, CREATED)
  })
  routes.post(`${root}/budget-items`, json(CreateBudgetItemSchema), auth, async c => {
    const input = c.req.valid('json')
    const now = clock()
    const view = await inCouncilChange(
      db,
      asked(c.get('userId'), c.req.param('councilId'), now),
      (tx, actor) => addBudgetItem(tx, actor, input, now),
    )
    return c.json(view satisfies BudgetResponse, CREATED)
  })
  return routes
}
