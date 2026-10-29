import { inArray } from 'drizzle-orm'
import { pushDevice } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { sqlState } from '../http/on-error.js'
import { forgetPushDevice } from './devices.js'
import type { PushMessage, PushSender } from './sender.js'

// 대화 알림은 하루 동안 알림 서버가 꺼진 기기를 기다린다(기능 003 '알림 전달'). 시험 알림은 sender 기본값(60초)이다.
const CHAT_TTL_SECONDS = 86_400
// 한꺼번에 알림 서버에 거는 연결 수. 받는 사람이 많아도 연결을 한없이 열지 않는다.
const BATCH = 20

type Device = { userId: string; endpoint: string; p256dh: string; auth: string }
type Kind = 'chat' | 'notice' | 'task' | 'purchase'
export type SkipReason =
  | 'deleted'
  | 'archived'
  | 'cancelled'
  | 'reassigned'
  | 'unassigned'
  | 'self'
  | 'reverted'
  | 'no_message'
type Counts = {
  recipients: number
  devices: number
  sent: number
  expired: number
  rejected: number
}
const emptyCounts = (): Counts => ({ recipients: 0, devices: 0, sent: 0, expired: 0, rejected: 0 })
function summarize(kind: Kind, counts: Counts, skipped?: SkipReason) {
  console.log(
    JSON.stringify({ event: 'push_fanout', kind, ...counts, ...(skipped ? { skipped } : {}) }),
  )
}

// 사람들의 기기마다 알림 한 번씩. 던지지 않는다: 커밋 뒤에 떼어 보내는 일이라 실패가 응답이나 프로세스에 닿으면 안 된다.
// 끝난 구독(404·410)은 그 기기 줄을 지운다. 실패는 종류와 상태 번호만 한 줄 남긴다(구독 주소, 본문, 사람 번호는 남기지 않는다).
export function createFanout(db: Db, send: PushSender) {
  async function deliverTo(device: Device, message: PushMessage) {
    try {
      const target = {
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth },
      }
      const { result, status, code } = await send(target, message, { ttl: CHAT_TTL_SECONDS })
      if (result !== 'sent')
        console.warn(JSON.stringify({ event: 'push_send_failed', result, status, code }))
      if (result === 'expired') await forgetPushDevice(db, device.userId, device.endpoint)
      return result
    } catch (error) {
      console.warn(JSON.stringify({ event: 'push_send_failed', sqlState: sqlState(error) }))
      return 'rejected' as const
    }
  }
  async function deliver(
    messages: ReadonlyMap<string, PushMessage>,
    options: { kind: Kind; recipients: number },
  ) {
    const counts = { ...emptyCounts(), recipients: options.recipients }
    try {
      if (!messages.size) return
      const devices = await db
        .select()
        .from(pushDevice)
        .where(inArray(pushDevice.userId, [...messages.keys()]))
      counts.devices = devices.length
      for (let at = 0; at < devices.length; at += BATCH) {
        const results = await Promise.all(
          devices
            .slice(at, at + BATCH)
            .map(device => deliverTo(device, messages.get(device.userId)!)),
        )
        for (const result of results) counts[result]++
      }
    } catch (error) {
      console.warn(JSON.stringify({ event: 'push_send_failed', sqlState: sqlState(error) }))
    } finally {
      summarize(options.kind, counts)
    }
  }
  return {
    // 사람마다 보낼 알림이 다르다(부름 받은 사람). 계정 번호 → 알림이다.
    deliver,
    skip: (kind: Kind, reason: SkipReason) => summarize(kind, emptyCounts(), reason),
  }
}
