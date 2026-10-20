import { useCallback, useEffect, useState } from 'react'
import { statusOf, type CouncilView } from '@vada/contracts'
import { getJson } from '@/lib/api'

export type CouncilViewState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'lost' } | { kind: 'ready'; view: CouncilView }

// 학생회 하나(학생회 정보, 지금 기수, 내 직급과 부서, 내 권한). 서버가 요청마다 소속을 다시 보므로,
// 권한 오류면 이 학생회의 운영진이 아니게 된 것이다(내보내졌거나 기수가 끝남). 다시 읽다 실패하면 보던 것을 그대로 둔다.
export function useCouncilView(councilId: string) {
  const [state, setState] = useState<CouncilViewState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<CouncilView>(
      `/api/organizations/${encodeURIComponent(councilId)}`,
      controller.signal,
    ).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setState({ kind: 'ready', view: result.data })
      else if (result.status === statusOf('FORBIDDEN')) setState({ kind: 'lost' })
      else setState(current => (current.kind === 'ready' ? current : { kind: 'failed' }))
    })
    return () => controller.abort()
  }, [councilId, attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  // 설정을 바꾸면 서버가 바뀐 학생회를 돌려준다. 그 값으로 바꾼다.
  const replace = useCallback((view: CouncilView) => setState({ kind: 'ready', view }), [])
  return { state, reload, replace }
}
