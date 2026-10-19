import { Hono } from 'hono'
import { PushSubscriptionSchema, type PushKeyResponse, type PushTestResponse } from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { isKnownPushService } from './endpoint.js'
import type { PushMessage, PushSender } from './sender.js'

export const TEST_MESSAGE: PushMessage = { title: 'VADA', body: '시험 알림이에요. 누르면 VADA가 열려요.', url: '/' }
export const TEST_DELAY_MS = 5_000
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 휴대폰 알림. 이번에는 기기를 저장하지 않고, 시험 알림을 보낼 때만 구독을 받아 쓰고 버린다(휴대폰 길 spec).
export function createPushRoutes(getSession: SessionReader, publicKey: string, send: PushSender, wait: (ms: number) => Promise<void> = sleep) {
  const routes = new Hono<SessionEnv>()
  const authenticated = requireSession(getSession)
  routes.get('/me/push', authenticated, c => c.json({ publicKey } satisfies PushKeyResponse))
  // 5초 기다렸다 보낸다. 그동안 사용자가 화면을 끄거나 홈으로 나가 잠금 화면의 알림을 본다.
  routes.post('/me/push/test', json(PushSubscriptionSchema), authenticated, async c => {
    const { endpoint, keys } = c.req.valid('json')
    if (!isKnownPushService(endpoint)) throw new ApiError('PUSH_SERVICE_UNSUPPORTED', 400)
    await wait(TEST_DELAY_MS)
    const result = await send({ endpoint, keys }, TEST_MESSAGE)
    // 구독 주소는 기기를 가리키는 비밀 주소라 남기지 않는다. 결과의 종류만 남긴다.
    if (result !== 'sent') console.warn(JSON.stringify({ event: 'push_test_failed', result }))
    return c.json({ result } satisfies PushTestResponse)
  })
  return routes
}
