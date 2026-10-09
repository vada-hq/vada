import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createAccessRoutes } from './access/access.js'
import type { createEventRoutes } from './events/events.js'
import type { createChatRoutes } from './chat/chat.js'
import type { createPurchaseRoutes } from './purchases/purchases.js'
import type { createDeliveryRoutes } from './deliveries/routes.js'
import type { createDeliveryWebhook } from './deliveries/webhook.js'
import type { createExpenseRoutes } from './expenses/routes.js'
import type { createOrganizationRoutes } from './organization/routes.js'
import type { createSettlementRoutes } from './settlement/routes.js'
import type { createBudgetRoutes } from './budget/routes.js'
import type { createIncomeRoutes } from './incomes/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  access?: ReturnType<typeof createAccessRoutes>
  events?: ReturnType<typeof createEventRoutes>
  chat?: ReturnType<typeof createChatRoutes>
  purchases?: ReturnType<typeof createPurchaseRoutes>
  deliveries?: ReturnType<typeof createDeliveryRoutes>
  expenses?: ReturnType<typeof createExpenseRoutes>
  settlement?: ReturnType<typeof createSettlementRoutes>
  budget?: ReturnType<typeof createBudgetRoutes>
  incomes?: ReturnType<typeof createIncomeRoutes>
  organization?: ReturnType<typeof createOrganizationRoutes>
  webhook?: ReturnType<typeof createDeliveryWebhook>
}

export function createApp({ auth, trustedOrigin, access, events, chat, purchases, deliveries, expenses, settlement, budget, incomes, organization, webhook }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (events) app.route('/api', events)
  if (access) app.route('/api', access)
  if (organization) app.route('/api', organization)
  if (chat) app.route('/api', chat)
  if (purchases) app.route('/api', purchases)
  if (deliveries) app.route('/api', deliveries)
  if (expenses) app.route('/api', expenses)
  if (settlement) app.route('/api', settlement)
  if (budget) app.route('/api', budget)
  if (incomes) app.route('/api', incomes)
  // 외부 공급자가 호출하므로 공통 가드 밖에 두고 자체 검사를 한다.
  if (webhook) app.route('/api', webhook)
  app.onError(handleError)
  return app
}
