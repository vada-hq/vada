import { useCallback, useEffect, useState } from 'react'
import { statusOf, type ChatMessage, type NoticeListResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { chatBase } from './chat-api'

export type NoticesState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; notices: ChatMessage[] }

// 공지 모아 보기: 같은 기수의 공지 전체(들어오기 전 것도). 열 때 한 번 읽는다.
export function useNotices(councilId: string, onForbidden: () => void) {
  const [state, setState] = useState<NoticesState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const forbidden = useLatest(onForbidden)
  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    void getJson<NoticeListResponse>(`${chatBase(councilId)}/notices`, controller.signal).then(
      result => {
        if (controller.signal.aborted) return
        if (!result.ok && result.status === statusOf('FORBIDDEN')) forbidden.current()
        setState(result.ok ? { kind: 'ready', notices: result.data.notices } : { kind: 'failed' })
      },
    )
    return () => controller.abort()
  }, [councilId, attempt, forbidden])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  return { state, retry }
}
