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

// 대화 알림(기능 003). 잠금 화면에 보이는 본문은 앞 100자까지다. 사진만 보내면 '사진'이다.
export const PUSH_BODY_MAX = 100
export const PUSH_PHOTO_BODY = '사진'
// 알림을 누르면 열 방 주소. 화면은 chatRoomFromPath로 읽는다. 둘은 한 쌍이다.
export const chatRoomUrl = (councilId: string, roomId: string) => `/chat/${councilId}/${roomId}`
export function chatRoomFromPath(pathname: string) {
  const match = /^\/chat\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!match) return null
  try {
    return { councilId: decodeURIComponent(match[1]!), roomId: decodeURIComponent(match[2]!) }
  } catch {
    return null
  }
}
export const chatRoomTag = (roomId: string) => `room:${roomId}`

// 업무를 맡았다는 알림을 누르면 열 업무 주소. 화면은 taskFromPath로 읽는다. 둘은 한 쌍이다.
export const taskUrl = (councilId: string, taskId: string) => `/tasks/${councilId}/${taskId}`
export function taskFromPath(pathname: string) {
  const match = /^\/tasks\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!match) return null
  try {
    return { councilId: decodeURIComponent(match[1]!), taskId: decodeURIComponent(match[2]!) }
  } catch {
    return null
  }
}
export const taskTag = (taskId: string) => `task:${taskId}`

// 구매 요청 알림을 누르면 열 요청 주소. 화면은 purchaseRequestFromPath로 읽는다. 둘은 한 쌍이다.
export const purchaseRequestUrl = (councilId: string, requestId: string) =>
  `/purchases/${councilId}/${requestId}`
export function purchaseRequestFromPath(pathname: string) {
  const match = /^\/purchases\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!match) return null
  try {
    return { councilId: decodeURIComponent(match[1]!), requestId: decodeURIComponent(match[2]!) }
  } catch {
    return null
  }
}
export const purchaseRequestTag = (requestId: string) => `request:${requestId}`
