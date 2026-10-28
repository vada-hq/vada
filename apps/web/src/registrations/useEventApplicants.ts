import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type EventApplicantsQuery, type EventApplicantsResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_LOST } from '@/lib/registration-messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'

type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: EventApplicantsResponse }

export const eventApplicantsPath = (councilId: string, eventId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/events/${encodeURIComponent(eventId)}/applicants`

function queryString(query: EventApplicantsQuery, accessToken: string | null) {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'page' && key !== 'accessToken' && value !== undefined && value !== '')
      params.set(key, String(value))
  }
  if (accessToken) params.set('accessToken', accessToken)
  return params.toString()
}

function noteFailedRead(status: number, handlers: EventDialogHandlers) {
  if (status === statusOf('FORBIDDEN')) {
    handlers.onForbidden()
    handlers.onLost(PERMISSION_CHANGED)
  }
  if (status === statusOf('NOT_FOUND')) handlers.onLost(REGISTRATION_STAFF_LOST)
}

// 토큰은 명단을 연 동안만 보관한다. 다시 검색하거나 쪽을 넘겨도 첫 열람 기록을 이어 쓴다.
export function useEventApplicants(
  councilId: string,
  eventId: string,
  handlers: EventDialogHandlers,
) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [query, setQuery] = useState<EventApplicantsQuery>({ page: 1 })
  const [busy, setBusy] = useState(false)
  const token = useRef<string | null>(null)
  const sequence = useRef(0)
  const latest = useRef(handlers)
  const path = eventApplicantsPath(councilId, eventId)
  const load = useCallback(async () => {
    const turn = ++sequence.current
    setBusy(true)
    const result = await getJson<EventApplicantsResponse>(
      `${path}?${queryString(query, token.current)}`,
    )
    if (turn !== sequence.current) return
    // 서버 재시작·만료로 토큰이 무효하면 새 열람을 한 번 시작한다.
    if (!result.ok && result.status === statusOf('INVALID_INPUT') && token.current) {
      token.current = null
      setQuery(before => ({ ...before, page: 1 }))
      return
    }
    setBusy(false)
    if (result.ok) {
      token.current = result.data.accessToken
      setState({ kind: 'ready', data: result.data })
      return
    }
    noteFailedRead(result.status, latest.current)
    setState({ kind: 'failed' })
  }, [path, query])
  const readLatest = useRef(load)
  useEffect(() => {
    latest.current = handlers
    readLatest.current = load
  })
  const invalidate = useCallback(() => {
    sequence.current++
  }, [])
  useEffect(() => {
    void load()
    return invalidate
  }, [load, invalidate])
  const reload = useCallback(() => readLatest.current(), [])
  return { state, query, setQuery, busy, reload }
}
