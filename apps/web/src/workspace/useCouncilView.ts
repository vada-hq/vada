import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type CouncilView } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { sameJson } from '@/lib/same-json'
import type { Reading } from '@/lib/use-lost'

// ready의 reading은 이 view를 가져온 읽기다. 내 요청이 성공해 부른 다시 읽기면 own이다.
export type CouncilViewState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'lost' }
  | { kind: 'ready'; view: CouncilView; reading: Reading }

// 학생회 하나(학생회 정보, 지금 기수, 내 직급과 부서, 내 권한). 서버가 요청마다 소속을 다시 보므로,
// 권한 오류면 이 학생회의 운영진이 아니게 된 것이다(내보내졌거나 기수가 끝남). 다시 읽다 실패하면 보던 것을 그대로 둔다.
export function useCouncilView(councilId: string) {
  const [state, setState] = useState<CouncilViewState>({ kind: 'loading' })
  // 다시 읽기 요청 하나가 곧 그 읽기다. 요청마다 새 객체라 effect가 다시 돈다.
  const [request, setRequest] = useState<Reading>({ own: false })
  // 내 변경 뒤 읽기가 15초 읽기에 취소돼도, 내 변경의 결과가 한 번 읽힐 때까지 own을 남긴다.
  const ownPending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<CouncilView>(
      `/api/organizations/${encodeURIComponent(councilId)}`,
      controller.signal,
    ).then(result => {
      if (controller.signal.aborted) return
      const reading: Reading = { own: ownPending.current }
      // 같은 값이면 지금 상태를 그대로 둔다(다시 그리지 않는다).
      if (result.ok) ownPending.current = false
      if (result.ok)
        setState(current =>
          current.kind === 'ready' && sameJson(current.view, result.data)
            ? current
            : { kind: 'ready', view: result.data, reading },
        )
      else if (result.status === statusOf('FORBIDDEN')) setState({ kind: 'lost' })
      else setState(current => (current.kind === 'ready' ? current : { kind: 'failed' }))
    })
    return () => controller.abort()
  }, [councilId, request])
  const reload = useCallback(() => setRequest({ own: false }), [])
  // 내 요청이 성공해 내 권한이 바뀌었을 때 부른다. 이 읽기가 가져온 값으로 생긴 사라짐은 바깥 변경이 아니다.
  const reloadAfterOwnChange = useCallback(() => {
    ownPending.current = true
    setRequest({ own: true })
  }, [])
  // 설정을 바꾸면 서버가 바뀐 학생회를 돌려준다. 그 값으로 바꾼다.
  const replace = useCallback(
    (view: CouncilView) => setState({ kind: 'ready', view, reading: { own: false } }),
    [],
  )
  return { state, reload, reloadAfterOwnChange, replace }
}
