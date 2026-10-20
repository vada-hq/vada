import { z } from 'zod'
import { token } from './input.js'

// 휴대폰 알림(웹 푸시). 브라우저 PushSubscription.toJSON()의 모양이다.
// 구독 주소는 기기를 가리키는 비밀 주소라 로그와 응답에 넣지 않는다.
export const PUSH_ENDPOINT_MAX = 1024
export const PUSH_KEY_P256DH_MAX = 200
export const PUSH_KEY_AUTH_MAX = 100
const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const PushSubscriptionSchema = z.strictObject({
  endpoint: token(PUSH_ENDPOINT_MAX).refine(isHttpsUrl),
  // 브라우저는 대개 null을 보낸다.
  expirationTime: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  keys: z.strictObject({ p256dh: token(PUSH_KEY_P256DH_MAX), auth: token(PUSH_KEY_AUTH_MAX) }),
})
export type PushSubscriptionRequest = z.infer<typeof PushSubscriptionSchema>

export const PUSH_TEST_RESULTS = ['sent', 'expired', 'rejected'] as const
export type PushTestResult = (typeof PUSH_TEST_RESULTS)[number]
export type PushKeyResponse = { publicKey: string }
export type PushTestResponse = { result: PushTestResult }

// 알림 받을 기기 지우기(바탕 spec G10). 지금 로그인한 계정의 기기만 지운다.
export const RemovePushDeviceSchema = z.strictObject({
  endpoint: PushSubscriptionSchema.shape.endpoint,
})
export type RemovePushDeviceRequest = z.infer<typeof RemovePushDeviceSchema>
