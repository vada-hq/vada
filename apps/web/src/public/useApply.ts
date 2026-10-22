import { useRef, useState } from 'react'
import {
  statusOf,
  ApplySchema,
  type ApplyRequest,
  type ApplyResponse,
  type PublicRegistrationForm,
} from '@vada/contracts'
import { postJson } from '@/lib/api'
import { APPLY_ERRORS, APPLY_FAILED } from '@/lib/messages'

export type ApplyValues = { name: string; studentId: string; phone: string }
export const EMPTY_VALUES: ApplyValues = { name: '', studentId: '', phone: '' }

type Collects = Pick<PublicRegistrationForm, 'collectsStudentId' | 'collectsPhone'>

// 받지 않는 칸은 보내지 않는다. 버튼을 켜는 판단과 보내는 본문이 같은 스키마에서 나온다.
export function parseApply(form: Collects, values: ApplyValues) {
  return ApplySchema.safeParse({
    name: values.name,
    studentId: form.collectsStudentId ? values.studentId : null,
    phone: form.collectsPhone ? values.phone : null,
  })
}

type Handlers = {
  code: string
  // 서버 상태가 바뀌었을 수 있는 409에서 양식을 다시 읽는다.
  reload: () => void
  onLost: () => void
  onApplied: (token: string) => void
}

// 신청 보내기. 두 번 누름은 동기 표지로 막는다(상태는 다음 그림부터 반영된다).
export function useApply({ code, reload, onLost, onApplied }: Handlers) {
  const sending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function submit(body: ApplyRequest) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setProblem('')
    const result = await postJson<ApplyResponse>(
      `/api/public/registration-forms/${encodeURIComponent(code)}/apply`,
      body,
    )
    sending.current = false
    setBusy(false)
    if (result.ok) return onApplied(result.data.token)
    if (result.status === statusOf('NOT_FOUND')) return onLost()
    // 409는 모두 양식 상태가 달라졌다는 뜻이다(마감, 정원, 칸 바뀜). 새로 읽어 화면이 지금 모습을 보이게 한다.
    if (result.status === statusOf('FORM_CHANGED')) reload()
    setProblem(APPLY_ERRORS[result.code] ?? APPLY_FAILED)
  }
  return { busy, problem, submit }
}
