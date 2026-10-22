import { useRef, useState } from 'react'
import { statusOf, type EventDetail, type EventResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { EVENT_ERRORS, EVENT_FAILED, EVENT_LOST, PERMISSION_CHANGED } from '@/lib/messages'

export type EventDialogHandlers = {
  // 대상이 사라졌거나(404) 권한을 잃었다(403). 부모가 대화상자를 닫고 이유를 보인다.
  onLost: (message: string) => void
  // 403이면 학생회를 다시 읽어 권한 목록을 새로 받는다.
  onForbidden: () => void
}

type Handlers = EventDialogHandlers & {
  onDone: (event: EventDetail) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
}

// 행사 쓰기 요청 하나(만들기, 고치기, 책임자 바꾸기). 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useEventSubmit(
  path: string,
  schema: { safeParse: (input: unknown) => { success: boolean } },
  request: unknown,
  handlers: Handlers,
) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const valid = schema.safeParse(request).success

  async function submit() {
    if (!valid || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<EventResponse>(path, request)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onDone(result.data.event)
    if (result.status === statusOf('FORBIDDEN')) {
      handlers.onForbidden()
      return handlers.onLost(PERMISSION_CHANGED)
    }
    if (result.status === statusOf('NOT_FOUND')) return handlers.onLost(EVENT_LOST)
    setProblem(EVENT_ERRORS[result.code] ?? EVENT_FAILED)
  }

  return { valid, problem, submit }
}
