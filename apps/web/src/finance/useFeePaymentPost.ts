import { useRef, useState } from 'react'
import { statusOf } from '@vada/contracts'
import { postJson } from '@/lib/api'
import {
  FEE_PAYMENT_ERRORS,
  FEE_PAYMENT_FAILED,
  FEE_PAYMENT_LOST,
  PERMISSION_CHANGED,
} from '@/lib/messages'

type Parser = { safeParse: (value: unknown) => { success: boolean } }

export type FeePaymentHandlers = {
  // 403이면 학생회를 다시 읽어 권한 목록을 새로 받는다.
  onForbidden: () => void
  // 이미 비워진 학번이거나(404) 권한을 잃었다(403). 부모가 대화상자를 닫고 이유를 보인다.
  onLost: (message: string) => void
}

// 올리기와 빼기가 같이 쓴다. 보내는 동안 다시 보내지 않는다.
// 형식이 틀린 학번이 있으면 서버가 줄 번호를 주므로 lines로 내보낸다(아무것도 쓰이지 않았다).
export function useFeePaymentPost<T>(
  path: string,
  body: unknown,
  schema: Parser,
  handlers: FeePaymentHandlers & {
    setSaving: (saving: boolean) => void
    onDone: (data: T) => void
    onReplaceRequired?: () => void
  },
) {
  const [problem, setProblem] = useState<string | null>(null)
  const [lines, setLines] = useState<number[]>([])
  const sending = useRef(false)
  const onReplaceRequired = handlers.onReplaceRequired ?? (() => {})

  async function submit(confirmedBody: unknown = body) {
    if (!schema.safeParse(confirmedBody).success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    setLines([])
    const result = await postJson<T>(path, confirmedBody)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onDone(result.data)
    if (result.code === 'FEE_PAYMENT_REPLACE_REQUIRED') return onReplaceRequired()
    if (result.status === statusOf('FORBIDDEN')) {
      handlers.onForbidden()
      return handlers.onLost(PERMISSION_CHANGED)
    }
    if (result.status === statusOf('NOT_FOUND')) return handlers.onLost(FEE_PAYMENT_LOST)
    setLines(result.lines ?? [])
    setProblem(FEE_PAYMENT_ERRORS[result.code] ?? FEE_PAYMENT_FAILED)
  }

  return { problem, lines, submit }
}
