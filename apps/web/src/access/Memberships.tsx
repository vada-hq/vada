import { useEffect, useState, type ReactNode } from 'react'
import type { MembershipSummary, MembershipsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

type Props = {
  renderMemberships?: (memberships: MembershipSummary[]) => ReactNode
  renderFallback?: (content: ReactNode) => ReactNode
  // 소속이 없을 때 보여 줄 내용. 앱에서는 초대 코드 입력이다.
  renderEmpty?: () => ReactNode
}
export default function Memberships({ renderMemberships, renderFallback = content => content, renderEmpty }: Props) {
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

  if (failed) return renderFallback(<section aria-label="내 소속" className="flex flex-col gap-3">
    <StateMessage kind="error">소속을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</Button>
  </section>)
  if (!result) return renderFallback(<StateMessage kind="loading">소속 확인 중…</StateMessage>)
  if (result.memberships.length && renderMemberships) return renderMemberships(result.memberships)
  if (!result.memberships.length && renderEmpty) return renderFallback(renderEmpty())
  return renderFallback(<section aria-label="내 소속" className="flex flex-col gap-3">
    {result.memberships.length === 0 ? <h2 className="text-lg font-semibold">아직 참여한 학생회가 없어요</h2> : (
      <><h2 className="text-lg font-semibold">내 소속</h2><ul className="flex flex-col gap-1">{result.memberships.map(membership => <li key={membership.id} className="text-sm wrap-anywhere text-gray-700">
        {membership.organization.name} · {membership.department?.name ?? '미배정'}
        {membership.department?.handlesFinance && <span className="text-xs text-gray-500"> (재정 담당)</span>}
      </li>)}</ul></>
    )}
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</Button>
  </section>)
}
