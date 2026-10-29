import webpush, { type RequestOptions } from 'web-push'
import { setTimeout } from 'node:timers/promises'
import { type PushTestResult } from '@vada/contracts'
import { GONE, NOT_FOUND } from '../http/status.js'
import type { PushConfig } from './config.js'
import { isKnownPushService } from './endpoint.js'

// tag는 같은 방의 알림을 서비스 워커가 한 줄로 접게 하는 이름이다(기능 003 '알림 전달').
export type PushMessage = { title: string; body: string; url: string; tag?: string }
type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } }
// 실패했을 때는 원인을 찾을 단서로 알림 서버의 상태 번호(status)나 연결 오류 코드(code)를 함께 돌려준다. 비밀이나 사용자 값은 담지 않는다.
type PushOutcome = { result: PushTestResult; status?: number; code?: string }
// ttl(초)은 알림 서버가 꺼진 기기를 기다려 주는 시간이다. 시험 알림은 60초, 대화 알림은 하루다.
export type PushSender = (
  target: PushTarget,
  message: PushMessage,
  options?: { ttl?: number },
) => Promise<PushOutcome>
type Send = (target: PushTarget, payload: string, options: RequestOptions) => Promise<unknown>

const TEST_TTL_SECONDS = 60
const SEND_TIMEOUT_MS = 10_000
const FIRST_RETRY_DELAY_MS = 500
const SECOND_RETRY_DELAY_MS = 1500
const RETRY_DELAYS_MS = [FIRST_RETRY_DELAY_MS, SECOND_RETRY_DELAY_MS]
const RETRY_AFTER_MAX_MS = 3000
const MILLISECONDS_PER_SECOND = 1000
const TOO_MANY_REQUESTS = 429
const SERVER_ERROR_START = 500
const SERVER_ERROR_END = 600
type Wait = (ms: number) => Promise<void>
const wait: Wait = async ms => {
  await setTimeout(ms)
}

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

function retryable(status: number | undefined) {
  return (
    status === undefined ||
    status === TOO_MANY_REQUESTS ||
    (status >= SERVER_ERROR_START && status < SERVER_ERROR_END)
  )
}

function retryDelay(error: unknown, fallback: number, now: Date) {
  if (diagnosisOf(error).status !== TOO_MANY_REQUESTS) return fallback
  const headers = (error as { headers?: Record<string, unknown> }).headers
  const value = headers?.['retry-after']
  if (typeof value !== 'string') return fallback
  const delay = /^\d+$/.test(value)
    ? Number(value) * MILLISECONDS_PER_SECOND
    : value.includes(':')
      ? Date.parse(value) - now.getTime()
      : Number.NaN
  return Number.isFinite(delay) ? Math.min(RETRY_AFTER_MAX_MS, Math.max(0, delay)) : fallback
}

type Timing = { pause: Wait; clock: () => Date }

async function sendWithRetry(
  attempt: () => Promise<unknown>,
  { pause, clock }: Timing,
): Promise<PushOutcome> {
  for (let retries = 0; ; retries++) {
    try {
      await attempt()
      return { result: 'sent' }
    } catch (error) {
      const diagnosis = diagnosisOf(error)
      const fallback = RETRY_DELAYS_MS[retries]
      if (fallback !== undefined && retryable(diagnosis.status)) {
        await pause(retryDelay(error, fallback, clock()))
        continue
      }
      return {
        result:
          diagnosis.status === NOT_FOUND || diagnosis.status === GONE ? 'expired' : 'rejected',
        ...diagnosis,
      }
    }
  }
}

// 알림 서버가 404·410을 주면 그 구독은 끝났다. 그 밖의 실패(거절, 시간 초과, 연결 실패)는 받지 않은 것으로 본다.
// 예상한 실패라 던지지 않고 결과로 돌려준다.
export function createPushSender(
  config: PushConfig,
  send: Send = sendWithLibrary,
  pause: Wait = wait,
  // Retry-After의 HTTP 날짜를 견줄 지금 시각. 앱 시계와 같은 꼴로 받는다(no-own-clock).
  clock: () => Date = () => new Date(),
): PushSender {
  const options: RequestOptions = {
    vapidDetails: {
      subject: config.subject,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
    },
    urgency: 'high',
    timeout: SEND_TIMEOUT_MS,
  }
  return async (target, message, { ttl = TEST_TTL_SECONDS } = {}) => {
    if (!isKnownPushService(target.endpoint)) return { result: 'rejected' }
    return sendWithRetry(() => send(target, JSON.stringify(message), { ...options, TTL: ttl }), {
      pause,
      clock,
    })
  }
}
