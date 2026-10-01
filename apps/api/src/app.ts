import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createAccessRoutes } from './access/access.js'
import type { createEventRoutes } from './events/events.js'
import type { createChatRoutes } from './chat/chat.js'
import type { createPurchaseRoutes } from './purchases/purchases.js'
import type { createDeliveryRoutes } from './deliveries/routes.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }

export function createApp(auth: AuthHandler, access?: ReturnType<typeof createAccessRoutes>, events?: ReturnType<typeof createEventRoutes>, chat?: ReturnType<typeof createChatRoutes>, purchases?: ReturnType<typeof createPurchaseRoutes>, deliveries?: ReturnType<typeof createDeliveryRoutes>) {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (events) app.route('/api', events)
  if (access) app.route('/api', access)
  if (chat) app.route('/api', chat)
  if (purchases) app.route('/api', purchases)
  if (deliveries) app.route('/api', deliveries)
  app.onError((_, c) => c.json({ error: 'Internal server error' }, 500))
  return app
}
