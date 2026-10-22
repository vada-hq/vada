import { serve } from '@hono/node-server'
import { readRuntime } from './runtime.js'
import { attachWeb } from './web.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createApp } from './app.js'
import { createAgreement } from './agreement/routes.js'
import { createAuth } from './auth/auth.js'
import { createChatPush } from './chat/notify.js'
import { createChatRoutes } from './chat/routes.js'
import { createCouncilRoutes } from './councils/routes.js'
import { startErrorReporting, stopErrorReporting } from './http/sentry.js'
import { createInviteRoutes } from './invites/routes.js'
import { pushConfigFrom } from './push/config.js'
import { createPushDeviceRoutes, forgetPushDevice } from './push/devices.js'
import { createPushRoutes } from './push/routes.js'
import { createPushSender } from './push/sender.js'
import { createR2Storage, r2ConfigFrom } from './storage/storage.js'
import { createTeamRoutes } from './team/routes.js'
import { createBudgetRoutes } from './budget/routes.js'
import { createExpenseRoutes } from './expenses/routes.js'
import { createPurchasePush } from './purchases/notify.js'
import { createPurchaseRoutes } from './purchases/routes.js'
import { createPurchaseWriteLimiter } from './purchases/write-limit.js'
import { createAccountRoutes } from './accounts/routes.js'
import { createEventRoutes } from './events/routes.js'
import { createDepositRoutes } from './deposits/routes.js'
import { createSettlementRoutes } from './settlement/routes.js'
import { createPublicRegistrationRoutes } from './registrations/public-routes.js'
import { createFeePaymentRoutes } from './fee-payments/routes.js'
import { startPurge } from './purge/run.js'
import { createRegistrationRoutes } from './registrations/routes.js'
import { createHomeRoutes } from './home/routes.js'
import { createTaskPush } from './tasks/notify.js'
import { createTaskRoutes } from './tasks/routes.js'
import type { SessionReader } from './auth/require-session.js'
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
function pushOf(env: Env, db: Db, session: SessionReader) {
  const pushConfig = pushConfigFrom(env)
  if (!pushConfig) return {}
  console.log('휴대폰 알림 켜짐 (Web Push)')
  const send = createPushSender(pushConfig)
  return {
    routes: createPushRoutes(session, {
      publicKey: pushConfig.publicKey,
      send,
      forget: (userId, endpoint) => forgetPushDevice(db, userId, endpoint),
    }),
    chatPush: createChatPush(db, send),
    taskPush: createTaskPush(db, send),
    purchasePush: createPurchasePush(db, send),
  }
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
  const push = pushOf(env, db, session)
  // 요청 내기와 지출 적기가 한도 하나를 같이 쓰도록 같은 인스턴스를 둘에 준다.
  const writeLimiter = createPurchaseWriteLimiter()
  // 대화와 증빙이 같은 저장소를 쓴다.
  const storage = storageOf(env)
  return createApp({
    auth,
    trustedOrigin: env.BETTER_AUTH_URL!,
    councils: createCouncilRoutes(db, session),
    invites: createInviteRoutes(db, session),
    team: createTeamRoutes(db, session),
    chat: createChatRoutes(db, session, { push: push.chatPush, storage }),
    push: push.routes,
    pushDevices: createPushDeviceRoutes(db, session),
    tasks: createTaskRoutes(db, session, { push: push.taskPush }),
    home: createHomeRoutes(db, session),
    purchases: createPurchaseRoutes(db, session, { push: push.purchasePush, writeLimiter }),
    budget: createBudgetRoutes(db, session),
    expenses: createExpenseRoutes(db, session, { writeLimiter, storage }),
    agreement: createAgreement(db, session),
    events: createEventRoutes(db, session),
    accounts: createAccountRoutes(db, session),
    registrations: createRegistrationRoutes(db, session),
    deposits: createDepositRoutes(db, session),
    settlement: createSettlementRoutes(db, session),
    feePayments: createFeePaymentRoutes(db, session),
    publicRegistrations: createPublicRegistrationRoutes(db),
  })
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
