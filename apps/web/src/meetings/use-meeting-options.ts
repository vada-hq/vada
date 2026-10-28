import { useEffect, useRef, useState } from 'react'
import type { MeetingOptionsResponse } from '@vada/contracts'
import { useLatest } from '@/lib/use-latest'
import type { MeetingFormValue } from './meeting-form'

export type ReadMeetingOptions = (
  eventId: string,
  departmentId: string,
) => Promise<MeetingOptionsResponse | null>
const EMPTY: MeetingOptionsResponse = {
  departments: [],
  events: [],
  members: [],
  defaultAttendeeIds: [],
}
function useOptionRequest(
  scope: [string, string],
  read: ReadMeetingOptions,
  initial?: MeetingOptionsResponse,
) {
  const [data, setData] = useState(initial ?? EMPTY)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(initial ? 'ready' : 'loading')
  const [attempt, setAttempt] = useState(0)
  const latest = useLatest(read)
  const first = useRef(Boolean(initial))
  const [eventId, departmentId] = scope
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    let active = true
    setState('loading')
    void latest.current(eventId, departmentId).then(options => {
      if (!active) return
      if (options) setData(options)
      setState(options ? 'ready' : 'failed')
    })
    return () => {
      active = false
    }
  }, [eventId, departmentId, latest, attempt])
  return {
    data,
    loading: state === 'loading',
    failed: state === 'failed',
    reload: () => setAttempt(before => before + 1),
  }
}
type Args = {
  value: MeetingFormValue
  creatorId: string | null
  editing: boolean
  read: ReadMeetingOptions
  setAttendees: (ids: string[]) => void
  initial?: MeetingOptionsResponse | undefined
}
export function useMeetingOptions({
  value,
  creatorId,
  editing,
  read,
  setAttendees,
  initial,
}: Args) {
  const scope: [string, string] = [
    value.type === 'event' ? value.eventId : '',
    value.hostDepartmentId,
  ]
  const options = useOptionRequest(scope, read, initial)
  const initialScope = useRef(scope.join(':'))
  const seen = useRef(initial)
  const modified = useRef(false)
  const latest = useLatest(setAttendees)
  const scopeKey = scope.join(':')
  useEffect(() => {
    if (options.loading || options.failed || seen.current === options.data) return
    const preserve = !seen.current && editing && initialScope.current === scopeKey
    seen.current = options.data
    if (!modified.current && !preserve)
      latest.current([
        ...new Set([...options.data.defaultAttendeeIds, ...(creatorId ? [creatorId] : [])]),
      ])
  }, [options.data, options.loading, options.failed, editing, creatorId, latest, scopeKey])
  return {
    ...options,
    markModified: () => {
      modified.current = true
    },
  }
}
