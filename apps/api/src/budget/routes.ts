import { Hono, type Context } from 'hono'
import {
  BudgetQuerySchema,
  CreateBudgetItemSchema,
  CreateBudgetItemsSchema,
  CreateFiscalPeriodSchema,
  EmptyRequestSchema,
  UpdateBudgetItemSchema,
  type BudgetResponse,
  type FinanceOverviewResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db, Tx } from '../db/types.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { financeOverviewOf } from './overview.js'
import { budgetOf } from './queries.js'
import { deleteBudgetItem, updateBudgetItem } from './item-change.js'
import { addBudgetItem, addBudgetItems, createFiscalPeriod } from './service.js'

const root = '/organizations/:councilId'
const CREATED = 201

// 읽기는 한 시점의 모습이다(업무와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

const asked = (userId: string, councilId: string | undefined, now: Date) => ({
  userId,
  councilId: councilIdOf(councilId),
  action: 'council.view' as const,
  now,
})

type Change = (
  c: Context<SessionEnv>,
  now: Date,
  run: (tx: Tx, actor: Actor) => Promise<BudgetResponse>,
) => Promise<BudgetResponse>
type Kit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  clock: () => Date
  change: Change
}

// 예산 항목의 쓰기. 여러 행 넣기(batch)는 항목 번호 경로(:itemId)보다 먼저 둔다. 'batch'가 번호 자리로 읽히지 않게 한다.
function itemRoutes({ routes, auth, clock, change }: Kit) {
  routes.post(`${root}/budget-items`, json(CreateBudgetItemSchema), auth, async c => {
    const input = c.req.valid('json')
    const now = clock()
    const view = await change(c, now, (tx, actor) => addBudgetItem(tx, actor, input, now))
    return c.json(view satisfies BudgetResponse, CREATED)
  })
  routes.post(`${root}/budget-items/batch`, json(CreateBudgetItemsSchema), auth, async c => {
    const { items } = c.req.valid('json')
    const now = clock()
    const view = await change(c, now, (tx, actor) => addBudgetItems(tx, actor, items, now))
    return c.json(view satisfies BudgetResponse, CREATED)
  })
  routes.post(`${root}/budget-items/:itemId`, json(UpdateBudgetItemSchema), auth, async c => {
    const itemId = recordIdOf(c.req.param('itemId'))
    const input = c.req.valid('json')
    const view = await change(c, clock(), (tx, actor) => updateBudgetItem(tx, actor, itemId, input))
    return c.json(view satisfies BudgetResponse)
  })
  routes.post(`${root}/budget-items/:itemId/delete`, json(EmptyRequestSchema), auth, async c => {
    const itemId = recordIdOf(c.req.param('itemId'))
    const view = await change(c, clock(), (tx, actor) => deleteBudgetItem(tx, actor, itemId))
    return c.json(view satisfies BudgetResponse)
  })
}

// 회계 기간과 예산 항목, 재정 첫 화면. 모든 운영진이 보고(PRIN-5), 만들고 고치고 지우는 것은 재정부만이다.
export function createBudgetRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const change: Change = (c, now, run) =>
    inCouncilChange(db, asked(c.get('userId'), c.req.param('councilId'), now), run)
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
  // 재정 첫 화면(개요): 모든 운영진이 본다(DEC-92). 기간은 예산 읽기와 같은 쿼리다.
  routes.get(`${root}/finance-overview`, auth, async c => {
    const now = clock()
    const request = asked(c.get('userId'), c.req.param('councilId'), now)
    const { period } = parseQuery(BudgetQuerySchema, c.req.queries())
    const view = await db.transaction(
      async tx => financeOverviewOf(tx, await authorize(tx, request), now, period),
      snapshot,
    )
    return c.json(view satisfies FinanceOverviewResponse)
  })
  routes.post(`${root}/fiscal-periods`, json(CreateFiscalPeriodSchema), auth, async c => {
    const input = c.req.valid('json')
    const view = await change(c, clock(), (tx, actor) => createFiscalPeriod(tx, actor, input))
    return c.json(view satisfies BudgetResponse, CREATED)
  })
  itemRoutes({ routes, auth, clock, change })
  return routes
}
