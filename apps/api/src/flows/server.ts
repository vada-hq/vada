import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import type { Db } from '../db/types.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import type { FileStorage } from '../storage/storage.js'
import { createDriver } from './driver.js'
import { createFlowSession } from './flow-session.js'
import { createScenarioClock, type ClockScope } from './scenario-clock.js'

const FLOW_ORIGIN = 'http://127.0.0.1:5180'
// 흐름 서버는 영수증 해시를 이 값으로 만든다. 운영 비밀과 무관한 고정값이라 흐름 DB 안에서만 뜻이 있다.
const FLOW_RECEIPT_KEY = 'flow-receipt-key-not-a-secret'

// 흐름 서버: appModulesOf로 만든 앱이고 포트를 열지 않는다. 로그인은 없고(auth 경로는 모두 404) 인물은 흐름 전용 세션으로 고른다.
// db는 시험이면 PGlite, 시연이면 바깥 거래다. 시계는 db에 건다(scope는 scenario-clock.ts).
export async function startFlow(
  db: Db,
  { start, scope, storage }: { start: Date; scope: ClockScope; storage?: FileStorage },
) {
  const flowSession = createFlowSession()
  const clock = await createScenarioClock(db, start, scope)
  const modules = appModulesOf(db, flowSession.session, {
    clock: clock.now,
    writeLimiter: createPurchaseWriteLimiter(),
    receiptKey: FLOW_RECEIPT_KEY,
    storage,
  })
  const app = createApp({
    auth: { handler: () => Promise.resolve(new Response(null, { status: 404 })) },
    trustedOrigin: FLOW_ORIGIN,
    ...modules,
  })
  return { app, db, flowSession, driver: createDriver({ app, clock, origin: FLOW_ORIGIN }) }
}
export type Flow = Awaited<ReturnType<typeof startFlow>>
