import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type EventApplicantsResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_LOST } from '@/lib/registration-messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'

type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: EventApplicantsResponse }

export const eventApplicantsPath = (councilId: string, eventId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/events/${encodeURIComponent(eventId)}/applicants`

function noteFailedRead(status: number, handlers: EventDialogHandlers) {
  if (status === statusOf('FORBIDDEN')) {
    handlers.onForbidden()
    handlers.onLost(PERMISSION_CHANGED)
  }
  if (status === statusOf('NOT_FOUND')) handlers.onLost(REGISTRATION_STAFF_LOST)
}

// 명단을 한 번에 읽는다(DEC-93). 거르기·찾기·쪽 넘김은 화면이 해서 다시 부르지 않는다. 읽을 때마다 서버가 열람 기록을 남기므로
// 다시 읽기는 [새로 읽기]와 쓰기 뒤에만 한다.
export function useEventApplicants(
  councilId: string,
  eventId: string,
  handlers: EventDialogHandlers,
) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  const latest = useRef(handlers)
  const path = eventApplicantsPath(councilId, eventId)
  const load = useCallback(async () => {
    const turn = ++sequence.current
    setBusy(true)
    const result = await getJson<EventApplicantsResponse>(path)
    if (turn !== sequence.current) return
    setBusy(false)
    if (result.ok) {
      setState({ kind: 'ready', data: result.data })
      return
    }
    noteFailedRead(result.status, latest.current)
    setState({ kind: 'failed' })
  }, [path])
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
  return { state, busy, reload }
}
