import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type ApplicantsResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { REGISTRATION_STAFF_LOST } from '@/lib/registration-messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { applicantsPath } from './registration-api'

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: ApplicantsResponse }

// 신청자 목록. 읽을 때마다 서버가 열람 기록을 남기므로 15초 읽기를 하지 않고, 열 때와 [새로 읽기]를 눌렀을 때만 읽는다.
// 403이면 학생회를 다시 읽게 하고 부모가 닫는다. 404는 양식이 사라졌거나 지운 것이다.
export function useApplicants(
  councilId: string,
  formId: string,
  handlers: EventDialogHandlers,
  // 서버에서 새로 읽었다(그 값이 이 화면에서 바꾼 값보다 새롭다).
  onLoaded: (data: ApplicantsResponse) => void,
) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const latest = useRef(handlers)
  const loaded = useRef(onLoaded)
  useEffect(() => {
    latest.current = handlers
    loaded.current = onLoaded
  })
  const load = useCallback(async () => {
    const result = await getJson<ApplicantsResponse>(applicantsPath(councilId, formId))
    if (result.ok) {
      loaded.current(result.data)
      return setState({ kind: 'ready', data: result.data })
    }
    if (result.status === statusOf('FORBIDDEN')) {
      latest.current.onForbidden()
      return latest.current.onLost(PERMISSION_CHANGED)
    }
    if (result.status === statusOf('NOT_FOUND'))
      return latest.current.onLost(REGISTRATION_STAFF_LOST)
    // 다시 읽다 실패해도 보이던 목록은 그대로 둔다.
    setState(before => (before.kind === 'ready' ? before : { kind: 'failed' }))
  }, [councilId, formId])
  useEffect(() => {
    void load()
  }, [load])
  return { state, reload: load }
}
