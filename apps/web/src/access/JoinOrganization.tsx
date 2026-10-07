import { useEffect, useState } from 'react'
import type { InvitePreviewResponse, JoinOrganizationResponse } from '@vada/contracts'
import StateMessage from '../shared/ui/StateMessage'

type Props = { code: string; leaveLabel: string; onJoined: (organizationId: string) => void; onLeave: () => void }
type View = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'failed' }
  | { kind: 'ready'; organization: InvitePreviewResponse['organization'] }

// 와이어프레임 INV-01. 학생회를 확인하고 참여한다. 부서는 고르지 않고 미배정으로 등록된다.
export default function JoinOrganization({ code, leaveLabel, onJoined, onLeave }: Props) {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [joinFailed, setJoinFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    async function load() {
      try {
        const response = await fetch(`/api/invites/${encodeURIComponent(code)}`,
          { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (controller.signal.aborted) return
        if (response.status === 404) return setView({ kind: 'invalid' })
        if (!response.ok) throw new Error('Invite lookup failed')
        const preview = await response.json() as InvitePreviewResponse
        if (controller.signal.aborted) return
        // 이미 참여한 학생회면 묻지 않고 바로 연다.
        if (preview.joined) onJoined(preview.organization.id)
        else setView({ kind: 'ready', organization: preview.organization })
      } catch {
        if (!controller.signal.aborted) setView({ kind: 'failed' })
      }
    }
    void load()
    return () => controller.abort()
  }, [code, attempt])

  async function join() {
    setJoining(true)
    setJoinFailed(false)
    try {
      const response = await fetch('/api/organizations/join', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      if (response.status === 404) return setView({ kind: 'invalid' })
      if (!response.ok) throw new Error('Join failed')
      const { membership } = await response.json() as JoinOrganizationResponse
      onJoined(membership.organization.id)
    } catch {
      setJoinFailed(true)
    } finally {
      setJoining(false)
    }
  }

  if (view.kind === 'loading') return <StateMessage kind="loading">초대 확인 중…</StateMessage>
  if (view.kind === 'invalid') return <section aria-label="학생회 참여">
    <StateMessage kind="error">초대 코드가 올바르지 않아요. 다시 확인해 주세요.</StateMessage>
    <button onClick={onLeave}>{leaveLabel}</button>
  </section>
  if (view.kind === 'failed') return <section aria-label="학생회 참여">
    <StateMessage kind="error">초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>
    <button onClick={() => setAttempt(value => value + 1)}>다시 시도</button>
    <button className="button-quiet" onClick={onLeave}>{leaveLabel}</button>
  </section>
  return <section aria-label="학생회 참여">
    <h2>{view.organization.name}에 참여할까요?</h2>
    <p className="hint">참여하면 미배정 구성원으로 등록돼요.</p>
    {joinFailed && <StateMessage kind="error">참여하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>}
    <button disabled={joining} onClick={() => { void join() }}>{joining ? '참여하는 중…' : joinFailed ? '다시 시도' : '참여하기'}</button>
    <button className="button-quiet" disabled={joining} onClick={onLeave}>참여하지 않기</button>
  </section>
}
