import type { EventCompletionResponse, EventResponse, EventSummary } from '@vada/contracts'

const pathOf = (event: EventSummary) =>
  `/api/organizations/${encodeURIComponent(event.organizationId)}/events/${encodeURIComponent(event.id)}/completion`
export const completionErrors: Record<string, string> = {
  EVENT_NOT_SETTLED: '정산하지 않은 행사예요. 재정 탭에서 먼저 정산해 주세요.',
  VERSION_CONFLICT: '다른 곳에서 행사가 먼저 바뀌었어요. 행사 목록을 새로 불러왔어요.',
  INVALID_STATE: '이미 바뀌었어요. 행사 목록을 새로 불러왔어요.',
  FORBIDDEN: '회장단만 할 수 있어요.',
  NOT_FOUND: '행사를 찾을 수 없어요.',
}
const failure = '처리하지 못했어요. 다시 시도해 주세요.'
// 행사 목록이 오래된 경우다. 목록을 새로 받는다. 응답을 못 받았을 때(UNKNOWN)도 서버가 바꿨을 수 있어 새로 받는다.
export const staleCompletionCodes = new Set(['VERSION_CONFLICT', 'INVALID_STATE', 'NOT_FOUND', 'UNKNOWN'])

// 완료 확인 대화상자가 연다. 실패하면 null이다.
export async function loadCompletion(event: EventSummary): Promise<EventCompletionResponse | null> {
  try {
    const response = await fetch(pathOf(event), { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return null
    const body = await response.json() as EventCompletionResponse
    return typeof body.settled === 'boolean' && typeof body.openTasks === 'number' ? body : null
  } catch { return null }
}

export async function changeCompletion(event: EventSummary, action: 'complete' | 'cancel'):
  Promise<{ ok: true; event: EventSummary } | { ok: false; message: string; code: unknown }> {
  try {
    const response = await fetch(action === 'complete' ? pathOf(event) : `${pathOf(event)}/cancel`, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: event.version }) })
    const body = await response.json().catch(() => null) as (Partial<EventResponse> & { error?: unknown }) | null
    if (!response.ok) {
      const code = body?.error
      return { ok: false, code, message: typeof code === 'string' ? completionErrors[code] ?? failure : failure }
    }
    if (!body?.event?.id || body.event.id !== event.id) throw new Error('Invalid response')
    return { ok: true, event: body.event }
  } catch {
    return { ok: false, code: 'UNKNOWN', message: '결과를 확인하지 못했어요. 행사 목록을 새로 불러왔어요.' }
  }
}
