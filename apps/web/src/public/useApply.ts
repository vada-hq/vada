import { useCallback, useRef, useState } from 'react'
import {
  statusOf,
  ApplySchema,
  type ApplyRequest,
  type ApplyResponse,
  type PublicRegistrationForm,
} from '@vada/contracts'
import { postJson } from '@/lib/api'
import {
  APPLY_ERRORS,
  APPLY_FAILED,
  APPLY_PHONE_INVALID,
  APPLY_STUDENT_ID_INVALID,
} from '@/lib/registration-messages'
import { applyCommandId, clearApplyCommand } from './apply-command'
import { requiredText, withContract } from '@/lib/use-form-check'

export type ApplyValues = { name: string; studentId: string; phone: string }
export const EMPTY_VALUES: ApplyValues = { name: '', studentId: '', phone: '' }

const CHECK_COMMAND_ID = '00000000-0000-4000-8000-000000000000'

type Collects = Pick<PublicRegistrationForm, 'collectsStudentId' | 'collectsPhone'>

// 받지 않는 칸은 보내지 않는다. 버튼을 켜는 판단과 보내는 본문이 같은 스키마에서 나온다.
export function parseApply(form: Collects, values: ApplyValues) {
  // 칸 확인용 자리 값이다. 보낼 때 submit이 기기에 둔 번호로 바꾼다.
  return ApplySchema.safeParse({
    commandId: CHECK_COMMAND_ID,
    name: values.name,
    studentId: form.collectsStudentId ? values.studentId : null,
    phone: form.collectsPhone ? values.phone : null,
  })
}

// 누를 때 확인한 문제(칸 이름 → 글). 비었는지는 여기서, 형식과 길이는 보낼 때와 같은 스키마가 정한다.
export function applyErrors(form: Collects, values: ApplyValues) {
  return withContract(
    {
      name: requiredText(values.name, '이름을'),
      studentId: form.collectsStudentId ? requiredText(values.studentId, '학번을') : undefined,
      phone: form.collectsPhone ? requiredText(values.phone, '휴대폰 번호를') : undefined,
    },
    parseApply(form, values),
    { studentId: APPLY_STUDENT_ID_INVALID, phone: APPLY_PHONE_INVALID },
  )
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
  async function submit(checked: ApplyRequest) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setProblem('')
    // 값이 앞 시도와 같으면 같은 번호라, 응답을 잃었어도 서버가 같은 신청의 링크를 다시 준다.
    const { commandId: _placeholder, ...content } = checked
    const result = await postJson<ApplyResponse>(
      `/api/public/registration-forms/${encodeURIComponent(code)}/apply`,
      { commandId: applyCommandId(code, content), ...content },
    )
    // 성공이면 이동하는 동안 막힌 채 둔다. 풀면 이동 전에 다시 눌러 신청이 하나 더 생긴다.
    if (result.ok) {
      clearApplyCommand(code)
      return onApplied(result.data.token)
    }
    sending.current = false
    setBusy(false)
    if (result.status === statusOf('NOT_FOUND')) return onLost()
    // 같은 번호에 다른 본문이다. 번호를 버려 다음에 누르면 새 신청으로 간다.
    if (result.code === 'COMMAND_REUSED') clearApplyCommand(code)
    // 409 중 양식 상태가 달라진 것(마감, 정원, 칸 바뀜)만 새로 읽는다. COMMAND_CONFLICT는 같은 번호로 다시 보내도 된다.
    else if (result.status === statusOf('FORM_CHANGED') && result.code !== 'COMMAND_CONFLICT')
      reload()
    setProblem(APPLY_ERRORS[result.code] ?? APPLY_FAILED)
  }
  // 지난 시도의 문구는 칸을 고치거나 양식이 닫히면 거둔다. 남기면 다시 열렸을 때 묵은 이유가 보인다.
  const clearProblem = useCallback(() => setProblem(''), [])
  return { busy, problem, submit, clearProblem }
}
