import { serve } from '@hono/node-server'
import { readRuntime } from './runtime.js'
import { attachWeb } from './web.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createApp } from './app.js'
import { createAuth } from './auth/auth.js'
import { createAccessRoutes } from './access/access.js'
import { createOrganizationRoutes } from './organization/routes.js'
import { createEventRoutes } from './events/events.js'
import { createChatRoutes } from './chat/chat.js'
import { createPurchaseRoutes } from './purchases/purchases.js'
import { createDraftGenerator } from './purchases/generation.js'
import { createProductCatalog } from './purchases/catalog.js'
import { createLookupRunner } from './purchases/lookup-runner.js'
import { createReefFetcher } from './purchases/products.js'
import { createDeliveryRoutes } from './deliveries/routes.js'
import { createDeliveryTracker } from './deliveries/delivery-tracker.js'
import { createDeliveryWebhook } from './deliveries/webhook.js'
import { trackingConfig } from './deliveries/tracking-config.js'
import { startErrorReporting, stopErrorReporting } from './http/sentry.js'

function main() {
  const { env, production, hostname, port } = readRuntime(process.env, process.argv.includes('--production'))
  if (production) process.env.NODE_ENV = 'production'
  if (startErrorReporting(env.SENTRY_DSN, production ? 'production' : 'development')) console.log('오류 알림 켜짐 (Sentry)')
  const tracking = trackingConfig(env)
  // DB 마이그레이션은 서버 시작 시 자동 실행하지 않는다.
  const client = postgres(env.DATABASE_URL!, {
    max: 5, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {},
  })
  const db = drizzle(client)
  const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET!, baseURL: env.BETTER_AUTH_URL!,
    googleClientId: env.GOOGLE_CLIENT_ID!, googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
  })
  const access = createAccessRoutes(db, (headers) => auth.api.getSession({ headers }))
  const organization = createOrganizationRoutes(db, (headers) => auth.api.getSession({ headers }))
  const events = createEventRoutes(db, (headers) => auth.api.getSession({ headers }))
  // 키는 서버 런타임에서만 사용한다. 브라우저 응답·로그에 포함하지 않는다.
  const fetchProduct = env.REEF_API_KEY?.trim() ? createReefFetcher(env.REEF_API_KEY) : undefined
  // 대화의 쿠팡 링크는 이 서버 안에서 뒤에서 조회한다. 키가 없으면 켜지 않는다.
  const lookups = fetchProduct ? createLookupRunner(createProductCatalog(db, fetchProduct)) : undefined
  const chat = createChatRoutes(db, (headers) => auth.api.getSession({ headers }), lookups ? () => { void lookups.kick() } : undefined)
  const generate = createDraftGenerator({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL })
  const purchases = createPurchaseRoutes(db, (headers) => auth.api.getSession({ headers }), generate, fetchProduct)
  // 마이그레이션·추적 실행기 준비 전에는 기존 서비스에 노출하지 않는다.
  const deliveries = env.DELIVERY_ENABLED === 'true' ? createDeliveryRoutes(db,
    headers => auth.api.getSession({ headers }),
    createDeliveryTracker({ clientId: env.DELIVERY_TRACKER_CLIENT_ID, clientSecret: env.DELIVERY_TRACKER_CLIENT_SECRET }),
  ) : undefined
  const webhook = tracking ? createDeliveryWebhook(db, tracking.address) : undefined
  const app = createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, access, events, chat, purchases, deliveries, organization, webhook })
  if (production) attachWeb(app)
  const server = serve({ fetch: app.fetch, hostname, port }, () => {
    console.log(`VADA ${production ? '웹 + API' : 'API'} 서버 시작 (port ${port})`)
  })
  server.on('error', () => {
    console.error('서버 실행 실패. 호스트와 포트 사용 여부를 확인하세요.')
    void client.end({ timeout: 5 })
    process.exitCode = 1
  })
  const stopLookups = lookups?.start()
  const shutdown = () => {
    stopLookups?.()
    server.close(() => { void client.end({ timeout: 5 }); void stopErrorReporting() })
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

try {
  main()
} catch {
  console.error('서버 시작 실패. 설정을 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
}
