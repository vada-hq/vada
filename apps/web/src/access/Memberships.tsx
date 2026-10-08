import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { MembershipSummary, MembershipsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

type Props = {
  // refresh는 화면을 그대로 둔 채 소속만 다시 불러온다(본인 부서가 바뀌었을 때).
  renderMemberships?: (memberships: MembershipSummary[], refresh: () => void) => ReactNode
  renderFallback?: (content: ReactNode) => ReactNode
  // 소속이 없을 때 보여 줄 내용. 앱에서는 초대 코드 입력이다.
  renderEmpty?: () => ReactNode
}
export default function Memberships({ renderMemberships, renderFallback = content => content, renderEmpty }: Props) {
  const [result, setResult] = useState<MembershipsResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // 렌더마다 새 함수를 주면 받는 쪽 effect가 다시 돌아 요청이 되풀이된다. 같은 함수를 준다.
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
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

  if (failed && !result) return renderFallback(<section aria-label="내 소속" className="flex flex-col gap-3">
    <StateMessage kind="error">소속을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</Button>
  </section>)
  if (!result) return renderFallback(<StateMessage kind="loading">소속 확인 중…</StateMessage>)
  if (result.memberships.length && renderMemberships) return renderMemberships(result.memberships, refresh)
  if (!result.memberships.length && renderEmpty) return renderFallback(renderEmpty())
  return renderFallback(<section aria-label="내 소속" className="flex flex-col gap-3">
    {result.memberships.length === 0 ? <h2 className="text-lg font-semibold">아직 참여한 학생회가 없어요</h2> : (
      <><h2 className="text-lg font-semibold">내 소속</h2><ul className="flex flex-col gap-1">{result.memberships.map(membership => <li key={membership.id} className="text-sm wrap-anywhere text-gray-700">
        {membership.organization.name} · {membership.department?.name ?? '미배정'}
        {membership.permissions.approvePurchases && <span className="text-xs text-gray-500"> (구매 승인)</span>}
      </li>)}</ul></>
    )}
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</Button>
  </section>)
}
