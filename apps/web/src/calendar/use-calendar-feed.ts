import { useCallback, useEffect, useState } from 'react'
import {
  statusOf,
  type CalendarFeedResponse,
  type CreatedCalendarFeedResponse,
} from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import {
  CALENDAR_FEED_CREATE_FAILED,
  CALENDAR_FEED_DELETE_FAILED,
  CALENDAR_FEED_ERRORS,
} from '@/lib/messages'

export type FeedState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; feed: CalendarFeedResponse['feed']; url: string | null }

function useFeedRead(path: string, onForbidden: () => void) {
  const [state, setState] = useState<FeedState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const denied = useCallback(
    (status: number, code: string) => {
      if (status === statusOf('FORBIDDEN') && code === 'FORBIDDEN') onForbidden()
    },
    [onForbidden],
  )
  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    void getJson<CalendarFeedResponse>(path, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setState({ kind: 'ready', feed: result.data.feed, url: null })
      else {
        setState({ kind: 'failed' })
        denied(result.status, result.code)
      }
    })
    return () => controller.abort()
  }, [path, attempt, denied])
  return { state, setState, reload: () => setAttempt(value => value + 1), denied }
}

export function useCalendarFeed(councilId: string, onForbidden: () => void) {
  const path = `/api/organizations/${councilId}/calendar/feed`
  const { state, setState, reload, denied } = useFeedRead(path, onForbidden)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const change = async (action: 'create' | 'delete') => {
    setBusy(true)
    setError(null)
    const result = await postJson<CalendarFeedResponse | CreatedCalendarFeedResponse>(
      action === 'delete' ? `${path}/delete` : path,
      {},
    )
    setBusy(false)
    if (result.ok) {
      setState({
        kind: 'ready',
        feed: result.data.feed,
        url: 'url' in result.data ? result.data.url : null,
      })
      return true
    }
    denied(result.status, result.code)
    setError(
      CALENDAR_FEED_ERRORS[result.code] ??
        (action === 'delete' ? CALENDAR_FEED_DELETE_FAILED : CALENDAR_FEED_CREATE_FAILED),
    )
    return false
  }
  return { state, busy, error, change, reload }
}
