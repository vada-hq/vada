import { useEffect, useState } from 'react'
import { statusOf, type InvitePreviewResponse, type JoinCouncilResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { JOIN_COUNCIL_ERRORS, JOIN_COUNCIL_FAILED } from '@/lib/messages'
import { useLatest } from '@/lib/use-latest'

export type JoinView =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'failed' }
  | { kind: 'ready'; council: InvitePreviewResponse['council'] }

// 초대 링크 화면의 상태와 서버 부르기: 초대 확인, 들어가기. 이미 들어왔으면 묻지 않고 그 학생회를 연다.
export function useJoinCouncil(code: string, onJoined: (councilId: string) => void) {
  const [view, setView] = useState<JoinView>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const joined = useLatest(onJoined)
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    void getJson<InvitePreviewResponse>(
      `/api/invites/${encodeURIComponent(code)}`,
      controller.signal,
    ).then(result => {
      if (controller.signal.aborted) return
      if (!result.ok)
        return setView({ kind: result.status === statusOf('NOT_FOUND') ? 'invalid' : 'failed' })
      if (result.data.joined) joined.current(result.data.council.id)
      else setView({ kind: 'ready', council: result.data.council })
    })
    return () => controller.abort()
  }, [code, attempt, joined])

  async function join() {
    setJoining(true)
    setError('')
    const result = await postJson<JoinCouncilResponse>('/api/organizations/join', { code })
    if (result.ok) return onJoined(result.data.council.id)
    setJoining(false)
    if (result.status === statusOf('NOT_FOUND')) setView({ kind: 'invalid' })
    else setError(JOIN_COUNCIL_ERRORS[result.code] ?? JOIN_COUNCIL_FAILED)
  }
  return { view, joining, error, join, retry: () => setAttempt(value => value + 1) }
}
