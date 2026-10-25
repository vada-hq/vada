import { serve } from '@hono/node-server'
import { readRuntime } from './runtime.js'
import { attachWeb } from './web.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createApp } from './app.js'
import { appModulesOf } from './app-modules.js'
import { createAuth } from './auth/auth.js'
import { startErrorReporting, stopErrorReporting } from './http/sentry.js'
import { pushConfigFrom } from './push/config.js'
import { createPushSender } from './push/sender.js'
import { createR2Storage, r2ConfigFrom } from './storage/storage.js'
import { createPurchaseWriteLimiter } from './purchases/write-limit.js'
import { startPurge } from './purge/run.js'
import type { Db } from './db/types.js'

type Env = NodeJS.ProcessEnv

// DB 마이그레이션은 서버 시작 시 자동 실행하지 않는다.
function connectDb(env: Env) {
  const client = postgres(env.DATABASE_URL!, {
    max: 5,
    ssl: { rejectUnauthorized: true },
    connect_timeout: 15,
    onnotice: () => {},
  })
  return { client, db: drizzle(client) }
}

// 휴대폰 알림 열쇠는 서버에서만 쓴다. 없으면 알림 경로와 대화 알림을 만들지 않는다(대화는 알림 없이 돈다).
function pushOf(env: Env) {
  const pushConfig = pushConfigFrom(env)
  if (!pushConfig) return undefined
  console.log('휴대폰 알림 켜짐 (Web Push)')
  return { publicKey: pushConfig.publicKey, send: createPushSender(pushConfig) }
}

// 파일 저장소(R2) 값 넷이 모두 있어야 켠다. 없으면 사진만 막히고 서버와 글 대화는 돈다.
function storageOf(env: Env) {
  const config = r2ConfigFrom(env)
  if (config) console.log('파일 저장소 켜짐 (R2)')
  return config ? createR2Storage(config) : undefined
}

function appOf(env: Env, db: Db) {
  const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET!,
    baseURL: env.BETTER_AUTH_URL!,
    googleClientId: env.GOOGLE_CLIENT_ID!,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
  })
  const session = (headers: Headers) => auth.api.getSession({ headers })
  const modules = appModulesOf(db, session, {
    clock: () => new Date(),
    writeLimiter: createPurchaseWriteLimiter(),
    receiptKey: env.BETTER_AUTH_SECRET!,
    storage: storageOf(env),
    push: pushOf(env),
  })
  return createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, ...modules })
}

function listen(
  app: ReturnType<typeof appOf>,
  client: { end(options: { timeout: number }): Promise<void> },
  address: { hostname: string; port: number; production: boolean },
  stopPurge: () => void,
) {
  const { hostname, port, production } = address
  const server = serve({ fetch: app.fetch, hostname, port }, () => {
    console.log(`VADA ${production ? '웹 + API' : 'API'} 서버 시작 (port ${port})`)
  })
  server.on('error', () => {
    console.error('서버 실행 실패. 호스트와 포트 사용 여부를 확인하세요.')
    void client.end({ timeout: 5 })
    process.exitCode = 1
  })
  const shutdown = () => {
    stopPurge()
    server.close(() => {
      void client.end({ timeout: 5 })
      void stopErrorReporting()
    })
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

function main() {
  const { env, production, hostname, port } = readRuntime(
    process.env,
    process.argv.includes('--production'),
  )
  if (production) process.env.NODE_ENV = 'production'
  if (startErrorReporting(env.SENTRY_DSN, production ? 'production' : 'development'))
    console.log('오류 알림 켜짐 (Sentry)')
  const { client, db } = connectDb(env)
  const app = appOf(env, db)
  if (production) attachWeb(app)
  // 기한이 지난 개인정보와 열람 기록을 시작 때와 1시간마다 지운다.
  listen(app, client, { hostname, port, production }, startPurge(db))
}

try {
  main()
} catch {
  console.error('서버 시작 실패. 설정을 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
}
