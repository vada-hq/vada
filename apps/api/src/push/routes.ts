import { Hono } from 'hono'
import {
  PushSubscriptionSchema,
  type PushKeyResponse,
  type PushTestResponse,
} from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { sqlState } from '../http/on-error.js'
import { json } from '../http/validate.js'
import { isKnownPushService } from './endpoint.js'
import type { PushMessage, PushSender } from './sender.js'

export const TEST_MESSAGE: PushMessage = {
  title: 'VADA',
  body: '시험 알림이에요. 누르면 VADA가 열려요.',
  url: '/',
}
export const TEST_DELAY_MS = 5_000
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 끝난 구독의 저장된 기기를 지운다(바탕 spec G10). 기기는 devices.ts가 맡아, 이 모듈은 DB를 모른다.
export type ForgetDevice = (userId: string, endpoint: string) => Promise<void>

// 휴대폰 알림. 시험 알림은 저장한 기기와 상관없이 받은 구독으로 보낸다(휴대폰 길 spec). 기기 저장은 devices.ts가 맡는다.
// 끝난(expired) 구독이면 보낸 사람의 그 기기 줄도 지운다. 화면의 지우기 요청이 실패해도 줄이 남지 않는다. 지우기가 실패해도 시험 알림 결과는 그대로다.
export function createPushRoutes(
  getSession: SessionReader,
  publicKey: string,
  send: PushSender,
  wait: (ms: number) => Promise<void> = sleep,
  forget: ForgetDevice = async () => {},
) {
  const routes = new Hono<SessionEnv>()
  const authenticated = requireSession(getSession)
  routes.get('/me/push', authenticated, c => c.json({ publicKey } satisfies PushKeyResponse))
  // 5초 기다렸다 보낸다. 그동안 사용자가 화면을 끄거나 홈으로 나가 잠금 화면의 알림을 본다.
  routes.post('/me/push/test', json(PushSubscriptionSchema), authenticated, async c => {
    const { endpoint, keys } = c.req.valid('json')
    if (!isKnownPushService(endpoint)) throw new ApiError('PUSH_SERVICE_UNSUPPORTED', 400)
    await wait(TEST_DELAY_MS)
    const { result, status, code } = await send({ endpoint, keys }, TEST_MESSAGE)
    // 구독 주소는 기기를 가리키는 비밀 주소라 남기지 않는다. 결과의 종류와, 있으면 알림 서버의 상태 번호나 연결 오류 코드만 남긴다.
    if (result !== 'sent')
      console.warn(JSON.stringify({ event: 'push_test_failed', result, status, code }))
    // 기기 줄 지우기는 덤이다. 실패해도 시험 알림 결과는 그대로 돌려주고, 실패는 SQLSTATE만 남긴다(오류 메시지에 구독 주소가 들어 있을 수 있다).
    if (result === 'expired') {
      try {
        await forget(c.get('userId'), endpoint)
      } catch (error) {
        console.warn(
          JSON.stringify({ event: 'push_device_forget_failed', sqlState: sqlState(error) }),
        )
      }
    }
    return c.json({ result } satisfies PushTestResponse)
  })
  return routes
}
