import { useEffect, useState, type ReactNode } from 'react'
import type { MembershipSummary, MembershipsResponse } from '@vada/contracts'
import StateMessage from '../shared/ui/StateMessage'

type Props = { renderMemberships?: (memberships: MembershipSummary[]) => ReactNode; renderFallback?: (content: ReactNode) => ReactNode }
export default function Memberships({ renderMemberships, renderFallback = content => content }: Props) {
  const [result, setResult] = useState<MembershipsResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setFailed(false)
    async function load() {
      try {
        const response = await fetch('/api/me/memberships', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Membership lookup failed')
        const data = await response.json() as MembershipsResponse
        if (!Array.isArray(data.memberships)) throw new Error('Invalid response')
        if (!controller.signal.aborted) setResult(data)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])

  if (failed) return renderFallback(<section aria-label="내 소속"><StateMessage kind="error">소속을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage><button onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</button></section>)
  if (!result) return renderFallback(<StateMessage kind="loading">소속 확인 중…</StateMessage>)
  if (result.memberships.length && renderMemberships) return renderMemberships(result.memberships)
  return renderFallback(<section aria-label="내 소속">
    {result.memberships.length === 0 ? <><h2>소속 미지정</h2><p className="hint">테스트 담당자에게 학생회·부서 소속 지정을 요청해 주세요.</p></> : (
      <><h2>내 소속</h2><ul className="membership-list">{result.memberships.map(membership => <li key={membership.id}>
        {membership.organization.name} · {membership.department.name}
        {membership.department.handlesFinance && <span className="hint"> (재정 담당)</span>}
      </li>)}</ul></>
    )}
    <button onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</button>
  </section>)
}
