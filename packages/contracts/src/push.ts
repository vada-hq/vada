import { z } from 'zod'
import { token } from './input.js'
import { eventRoomPath, parseAppPath, recordPath, type RecordKind } from './paths.js'

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
// 알림을 누르면 열 주소. 주소 꼴의 원문은 paths.ts이고 알림 주소는 그 기록 주소 그대로다(이미 보낸 알림도 열린다).
// 새 행사 방 알림은 행사 메시지 탭이다. 옛 /chat 주소도 계속 읽고 화면이 방의 eventId로 옮긴다.
// 화면은 …FromPath로 읽는다. 학생회와 기록 칸은 uuid만 읽는다.
function recordFromPath(kind: RecordKind, pathname: string) {
  const location = parseAppPath(pathname)
  return location?.type === 'record' && location.record === kind ? location : null
}

export const chatRoomUrl = (councilId: string, roomId: string, eventId: string | null = null) =>
  eventId ? eventRoomPath(councilId, eventId, roomId) : recordPath('chat', councilId, roomId)
export function chatRoomFromPath(pathname: string) {
  const found = recordFromPath('chat', pathname)
  if (found) return { councilId: found.councilId, roomId: found.recordId }
  const event = recordFromPath('events', pathname)
  const roomId = event?.query['room']
  return event && roomId ? { councilId: event.councilId, roomId } : null
}
export const chatRoomTag = (roomId: string) => `room:${roomId}`

export const taskUrl = (councilId: string, taskId: string) => recordPath('tasks', councilId, taskId)
export function taskFromPath(pathname: string) {
  const found = recordFromPath('tasks', pathname)
  return found && { councilId: found.councilId, taskId: found.recordId }
}
export const taskTag = (taskId: string) => `task:${taskId}`

export const purchaseRequestUrl = (councilId: string, requestId: string) =>
  recordPath('purchases', councilId, requestId)
export function purchaseRequestFromPath(pathname: string) {
  const found = recordFromPath('purchases', pathname)
  return found && { councilId: found.councilId, requestId: found.recordId }
}
export const purchaseRequestTag = (requestId: string) => `request:${requestId}`
