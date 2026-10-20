import { useEffect, useState } from 'react'
import { statusOf, type InvitePreviewResponse, type JoinCouncilResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { getJson, postJson } from '@/lib/api'
import { JOIN_COUNCIL_ERRORS, JOIN_COUNCIL_FAILED } from '@/lib/messages'
import { useLatest } from '@/lib/use-latest'

type Props = {
  code: string
  leaveLabel: string
  onJoined: (councilId: string) => void
  onLeave: () => void
}
type View =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'failed' }
  | { kind: 'ready'; council: InvitePreviewResponse['council'] }

// 초대 링크(/join/코드): "OOO에 들어갈까요?" [들어가기]. 이미 들어왔으면 묻지 않고 그 학생회를 연다(바탕 spec '화면').
export default function JoinCouncil({ code, leaveLabel, onJoined, onLeave }: Props) {
  const [view, setView] = useState<View>({ kind: 'loading' })
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

  if (view.kind === 'loading') return <StateMessage kind="loading">초대 확인 중…</StateMessage>
  if (view.kind === 'invalid')
    return (
      <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
        <StateMessage kind="error">
          초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.
        </StateMessage>
        <Button variant="outline" onClick={onLeave}>
          {leaveLabel}
        </Button>
      </section>
    )
  if (view.kind === 'failed')
    return (
      <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
        <StateMessage kind="error">
          초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.
        </StateMessage>
        <Button onClick={() => setAttempt(value => value + 1)}>다시 시도</Button>
        <Button variant="ghost" size="sm" onClick={onLeave}>
          {leaveLabel}
        </Button>
      </section>
    )
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-4">
      <div className="rounded-lg border p-6">
        <h2 className="text-base font-semibold wrap-anywhere">{view.council.name}에 들어갈까요?</h2>
      </div>
      <p className="text-xs text-gray-400">
        들어가면 부서와 직급 없이 운영진이 돼요. 부서는 회장단이 정해요.
      </p>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex flex-col gap-2">
        <Button
          disabled={joining}
          onClick={() => {
            void join()
          }}
        >
          {joining ? '들어가는 중…' : '들어가기'}
        </Button>
        <Button variant="ghost" size="sm" disabled={joining} onClick={onLeave}>
          들어가지 않기
        </Button>
      </div>
    </section>
  )
}
