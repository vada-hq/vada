import { randomBytes } from 'node:crypto'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import type { Db } from '../db/types.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import type { FileStorage } from '../storage/storage.js'
import { createDriver } from './driver.js'
import { createFlowSession } from './flow-session.js'
import { createScenarioClock, type ClockScope } from './scenario-clock.js'

const RECEIPT_KEY_BYTES = 32
const FLOW_ORIGIN = 'http://127.0.0.1:5180'

// 흐름 서버: appModulesOf로 만든 앱이고 포트를 열지 않는다. 로그인은 없고(auth 경로는 모두 404) 인물은 흐름 전용 세션으로 고른다.
// db는 시험이면 PGlite, 시연이면 바깥 거래다. 시계는 db에 건다(scope는 scenario-clock.ts).
export async function startFlow(
  db: Db,
  { start, scope, storage }: { start: Date; scope: ClockScope; storage?: FileStorage },
) {
  const flowSession = createFlowSession()
  const clock = await createScenarioClock(db, start, scope, () => new Date())
  const modules = appModulesOf(db, flowSession.session, {
    trustedOrigin: FLOW_ORIGIN,
    clock: clock.now,
    writeLimiter: createPurchaseWriteLimiter(),
    // 실행마다 새로 만든다. 시연은 운영 DB에도 쓰므로 알려진 키로 신청 본문 해시를 남기지 않는다.
    receiptKey: randomBytes(RECEIPT_KEY_BYTES).toString('hex'),
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
