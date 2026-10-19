import webpush, { type RequestOptions } from 'web-push'
import type { PushTestResult } from '@vada/contracts'
import type { PushConfig } from './config.js'

export type PushMessage = { title: string; body: string; url: string }
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushTestResult>
type Send = (target: PushTarget, payload: string, options: RequestOptions) => Promise<unknown>

const sendWithLibrary: Send = (target, payload, options) => webpush.sendNotification(target, payload, options)

// 알림 서버가 404·410을 주면 그 구독은 끝났다. 그 밖의 실패(거절, 시간 초과, 연결 실패)는 받지 않은 것으로 본다.
// 예상한 실패라 던지지 않고 결과로 돌려준다.
export function createPushSender(config: PushConfig, send: Send = sendWithLibrary): PushSender {
  const options: RequestOptions = {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 60, urgency: 'high', timeout: 10_000,
  }
  return async (target, message) => {
    try {
      await send(target, JSON.stringify(message), options)
      return 'sent'
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode
      return status === 404 || status === 410 ? 'expired' : 'rejected'
    }
  }
}
