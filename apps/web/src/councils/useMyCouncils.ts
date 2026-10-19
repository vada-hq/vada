import { useCallback, useEffect, useState } from 'react'
import type { MyCouncil, MyCouncilsResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'

export type MyCouncilsState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; councils: MyCouncil[] }

// 내 학생회 목록(지금 소속이 있는 학생회). 다시 읽는 동안에는 보던 목록을 그대로 둔다.
export function useMyCouncils() {
  const [state, setState] = useState<MyCouncilsState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<MyCouncilsResponse>('/api/me/councils', controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setState({ kind: 'ready', councils: result.data.councils })
      else setState(current => current.kind === 'ready' ? current : { kind: 'failed' })
    })
    return () => controller.abort()
  }, [attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  // 방금 만든 학생회는 서버가 돌려준 줄을 바로 더한다.
  const add = useCallback((council: MyCouncil) => setState(current => ({ kind: 'ready',
    councils: [...(current.kind === 'ready' ? current.councils.filter(item => item.id !== council.id) : []), council] })), [])
  return { state, reload, add }
}
