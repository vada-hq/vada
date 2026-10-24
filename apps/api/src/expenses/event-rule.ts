import { eventsAgree } from '@vada/contracts'
import { ApiError } from '../http/errors.js'

// 지출의 행사는 결제 내역의 요청 행사와 같다(DEC-68). 요청에 행사가 없으면 묶이지 않는다.
// 요청들의 행사가 서로 다르면 어느 행사의 지출인지 정할 수 없어 409 EVENT_MISMATCH다.
function requestEventOf(lineEvents: readonly string[]): string | null {
  const distinct = [...new Set(lineEvents)]
  if (distinct.length > 1) throw new ApiError('EVENT_MISMATCH')
  return distinct[0] ?? null
}

// 적을 때: 행사를 빼면 요청의 행사로 채우고, 다르게 주면 409다.
export function eventOfNewExpense(lineEvents: readonly string[], wanted: string | null) {
  const fromRequest = requestEventOf(lineEvents)
  if (fromRequest === null) return wanted
  if (wanted !== null && wanted !== fromRequest) throw new ApiError('EVENT_MISMATCH')
  return fromRequest
}

// 고칠 때: 요청에 행사가 있으면 그 행사로만 바꿀 수 있다(비우는 것도 다른 값이다).
export function assertEventMatchesRequests(lineEvents: readonly string[], wanted: string | null) {
  const fromRequest = requestEventOf(lineEvents)
  if (fromRequest !== null && wanted !== fromRequest) throw new ApiError('EVENT_MISMATCH')
}

// 지출의 행사와 고른 예산 항목의 행사가 둘 다 있는데 다르면 409다. 어느 쪽 행사의 돈인지 갈린다.
export function assertEventMatchesItem(itemEvents: readonly string[], eventId: string | null) {
  if (itemEvents.some(itemEvent => !eventsAgree(eventId, itemEvent)))
    throw new ApiError('EVENT_MISMATCH')
}

// 지출의 행사가 비었고 고른 예산 항목에 행사가 있으면 그 행사로 채운다(요청의 행사로 채우는 것과 같은 규칙).
export function eventFilledFromItem(itemEvents: readonly string[], eventId: string | null) {
  return eventId ?? itemEvents[0] ?? null
}
