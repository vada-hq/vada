import webpush, { type RequestOptions } from 'web-push'
import type { PushTestResult } from '@vada/contracts'
import type { PushConfig } from './config.js'
import { isKnownPushService } from './endpoint.js'

export type PushMessage = { title: string; body: string; url: string }
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } }
// 실패했을 때는 원인을 찾을 단서로 알림 서버의 상태 번호(status)나 연결 오류 코드(code)를 함께 돌려준다. 비밀이나 사용자 값은 담지 않는다.
export type PushOutcome = { result: PushTestResult; status?: number; code?: string }
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushOutcome>
type Send = (target: PushTarget, payload: string, options: RequestOptions) => Promise<unknown>

const sendWithLibrary: Send = (target, payload, options) =>
  webpush.sendNotification(target, payload, options)

// 실패에서 꺼내는 것은 숫자 상태 번호, 없으면 ECONNRESET 같은 시스템 오류 코드뿐이다.
// 구독 주소, 본문, 열쇠, 오류 메시지는 비밀이거나 값이 들어 있을 수 있어 꺼내지 않는다. 던진 것이 객체가 아니어도(null 등) 던지지 않는다.
function diagnosisOf(error: unknown): Pick<PushOutcome, 'status' | 'code'> {
  if (typeof error !== 'object' || error === null) return {}
  const { statusCode, code } = error as { statusCode?: unknown; code?: unknown }
  if (typeof statusCode === 'number' && Number.isInteger(statusCode)) return { status: statusCode }
  if (typeof code === 'string' && /^E[A-Z_]+$/.test(code)) return { code }
  return {}
}

// 알림 서버가 404·410을 주면 그 구독은 끝났다. 그 밖의 실패(거절, 시간 초과, 연결 실패)는 받지 않은 것으로 본다.
// 예상한 실패라 던지지 않고 결과로 돌려준다.
export function createPushSender(config: PushConfig, send: Send = sendWithLibrary): PushSender {
  const options: RequestOptions = {
    vapidDetails: {
      subject: config.subject,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
    },
    TTL: 60,
    urgency: 'high',
    timeout: 10_000,
  }
  return async (target, message) => {
    if (!isKnownPushService(target.endpoint)) return { result: 'rejected' }
    try {
      await send(target, JSON.stringify(message), options)
      return { result: 'sent' }
    } catch (error) {
      const diagnosis = diagnosisOf(error)
      return {
        result: diagnosis.status === 404 || diagnosis.status === 410 ? 'expired' : 'rejected',
        ...diagnosis,
      }
    }
  }
}
