import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { PushSubscriptionSchema, RemovePushDeviceSchema } from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { pushDevice } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import type { Db } from '../records/records.js'
import { isKnownPushService } from './endpoint.js'

// JavaScript Date가 나타낼 수 있는 가장 늦은 시각(밀리초). 이보다 큰 만료 시각은 잘못된 값이다.
const DATE_MAX_MS = 8_640_000_000_000_000

// 그 사람의 기기 하나를 지운다. 없으면 아무것도 하지 않는다. 지우기 경로와 끝난 시험 알림(push/routes.ts)이 같이 쓴다.
export async function forgetPushDevice(db: Db, userId: string, endpoint: string) {
  await db.delete(pushDevice).where(and(eq(pushDevice.endpoint, endpoint), eq(pushDevice.userId, userId)))
}

// 알림 받을 기기(바탕 spec G10). 기기는 로그인 계정에 붙어, 학생회에 들어오기 전에도 알림을 켤 수 있다.
// 구독 주소는 기기를 가리키는 비밀 주소다. 로그와 응답에 넣지 않는다(응답은 본문 없는 204).
export function createPushDeviceRoutes(db: Db, getSession: SessionReader) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  // 같은 구독 주소면 열쇠와 만료 시각을 갱신하고, 지금 로그인한 계정의 기기로 둔다(한 브라우저는 마지막에 켠 계정이 쓴다).
  routes.post('/me/push/devices', json(PushSubscriptionSchema), auth, async c => {
    const { endpoint, keys, expirationTime } = c.req.valid('json')
    if (!isKnownPushService(endpoint)) throw new ApiError('PUSH_SERVICE_UNSUPPORTED', 400)
    if (expirationTime != null && expirationTime > DATE_MAX_MS) throw new ApiError('INVALID_INPUT', 400)
    const values = { userId: c.get('userId'), p256dh: keys.p256dh, auth: keys.auth, expirationTime: expirationTime == null ? null : new Date(expirationTime) }
    await db.insert(pushDevice).values({ endpoint, ...values }).onConflictDoUpdate({ target: pushDevice.endpoint, set: values })
    return c.body(null, 204)
  })
  // 지금 로그인한 계정의 기기만 지운다. 없으면 아무것도 하지 않는다.
  routes.post('/me/push/devices/remove', json(RemovePushDeviceSchema), auth, async c => {
    await forgetPushDevice(db, c.get('userId'), c.req.valid('json').endpoint)
    return c.body(null, 204)
  })
  return routes
}
