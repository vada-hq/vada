import { serve } from '@hono/node-server'
import { readRuntime } from './runtime.js'
import { attachWeb } from './web.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createApp } from './app.js'
import { createAuth } from './auth/auth.js'
import { createCouncilRoutes } from './councils/routes.js'
import { startErrorReporting, stopErrorReporting } from './http/sentry.js'
import { createInviteRoutes } from './invites/routes.js'
import { pushConfigFrom } from './push/config.js'
import { createPushRoutes } from './push/routes.js'
import { createPushSender } from './push/sender.js'

function main() {
  const { env, production, hostname, port } = readRuntime(process.env, process.argv.includes('--production'))
  if (production) process.env.NODE_ENV = 'production'
  if (startErrorReporting(env.SENTRY_DSN, production ? 'production' : 'development')) console.log('오류 알림 켜짐 (Sentry)')
  // DB 마이그레이션은 서버 시작 시 자동 실행하지 않는다.
  const client = postgres(env.DATABASE_URL!, {
    max: 5, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {},
  })
  const db = drizzle(client)
  const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET!, baseURL: env.BETTER_AUTH_URL!,
    googleClientId: env.GOOGLE_CLIENT_ID!, googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
  })
  const session = (headers: Headers) => auth.api.getSession({ headers })
  const councils = createCouncilRoutes(db, session)
  const invites = createInviteRoutes(db, session)
  // 휴대폰 알림 열쇠는 서버에서만 쓴다. 없으면 알림 경로를 만들지 않는다.
  const pushConfig = pushConfigFrom(env)
  if (pushConfig) console.log('휴대폰 알림 켜짐 (Web Push)')
  const push = pushConfig
    ? createPushRoutes(session, pushConfig.publicKey, createPushSender(pushConfig))
    : undefined
  const app = createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, councils, invites, push })
  if (production) attachWeb(app)
  const server = serve({ fetch: app.fetch, hostname, port }, () => {
    console.log(`VADA ${production ? '웹 + API' : 'API'} 서버 시작 (port ${port})`)
  })
  server.on('error', () => {
    console.error('서버 실행 실패. 호스트와 포트 사용 여부를 확인하세요.')
    void client.end({ timeout: 5 })
    process.exitCode = 1
  })
  const shutdown = () => {
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
