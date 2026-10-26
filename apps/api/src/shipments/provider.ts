import { z } from 'zod'
import type { ShipmentCarrier, TrackingResult } from '@vada/contracts'

const ENDPOINT = 'https://apis.tracker.delivery/graphql'
const TIMEOUT_MS = 10_000
const BODY_MAX_BYTES = 65_536
const STATUS_CODE_MAX = 100
const STATUS_NAME_MAX = 200
const DESCRIPTION_MAX = 4000
// DEC-61·74: 사람·연락처·전체 사건은 요청하지 않는다. tracker.delivery/docs/tracking-api
const QUERY = `query Track($carrierId: ID!, $trackingNumber: String!) {
  track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
    lastEvent { time status { code name } description }
  }
}`
export type Parcel = { carrierId: ShipmentCarrier; trackingNumber: string }
export type DeliveryLookup = (parcel: Parcel) => Promise<TrackingResult>
const Envelope = z.object({
  data: z.object({
    track: z
      .object({
        lastEvent: z
          .object({
            time: z.iso.datetime({ offset: true }).nullable(),
            status: z.object({
              code: z.string().min(1).max(STATUS_CODE_MAX),
              name: z.string().max(STATUS_NAME_MAX).nullable(),
            }),
            description: z.string().max(DESCRIPTION_MAX).nullable(),
          })
          .nullable(),
      })
      .nullable(),
  }),
})

async function bodyOf(response: Response) {
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength
    if (size > BODY_MAX_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(part.value)
  }
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as unknown
}

function parsedResult(body: unknown): TrackingResult {
  if (body && typeof body === 'object' && 'errors' in body)
    return { lastEvent: null, reason: 'provider_failed' }
  const parsed = Envelope.safeParse(body)
  if (!parsed.success) return { lastEvent: null, reason: 'invalid_response' }
  const lastEvent = parsed.data.data.track?.lastEvent
  return lastEvent ? { lastEvent, reason: null } : { lastEvent: null, reason: 'not_found' }
}

async function resultOf(response: Response, signal: AbortSignal): Promise<TrackingResult> {
  if (!response.ok) {
    await response.body?.cancel()
    return { lastEvent: null, reason: 'provider_failed' }
  }
  try {
    return parsedResult(await bodyOf(response))
  } catch {
    return { lastEvent: null, reason: signal.aborted ? 'timeout' : 'invalid_response' }
  }
}
// API key는 client_id:client_secret 한 값이다. 인증·응답·오류 원문을 로그나 Sentry로 넘기지 않는다.
export function createDeliveryLookup({
  apiKey,
  fetcher = fetch,
  timeoutMs = TIMEOUT_MS,
}: {
  apiKey: string
  fetcher?: typeof fetch
  timeoutMs?: number
}): DeliveryLookup {
  return async parcel => {
    const signal = AbortSignal.timeout(timeoutMs)
    try {
      const response = await fetcher(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `TRACKQL-API-KEY ${apiKey}` },
        body: JSON.stringify({ query: QUERY, variables: parcel }),
        redirect: 'error',
        signal,
      })
      return await resultOf(response, signal)
    } catch (error) {
      return {
        lastEvent: null,
        reason:
          signal.aborted || (error instanceof Error && error.name === 'TimeoutError')
            ? 'timeout'
            : 'provider_failed',
      }
    }
  }
}
