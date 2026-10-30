import { useRef, useState } from 'react'
import { postJson } from '@/lib/api'
import type { Parsed } from '@/lib/use-form-check'
import { ACCOUNT_ERRORS, ACCOUNT_FAILED, ACCOUNT_LOST } from '@/lib/messages'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

export type AccountChangeHandlers = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  // 저장됐다. 부모가 목록을 다시 읽고 대화상자를 닫는다.
  onSaved: () => void
}

type Parser = { safeParse: (value: unknown) => Parsed }

// 이미 닫은 계좌: 입력을 더 받아 봐야 소용없으니 대화상자를 닫고 목록을 새로 읽게 한다.
const STALE_CODES = ['ACCOUNT_CLOSED']

// 계좌 더하기, 고치기, 닫기가 같이 쓴다. 계약의 safeParse를 넘을 때만 보내고, 보내는 동안 다시 보내지 않는다.
export function useAccountChange(
  path: string,
  body: unknown,
  schema: Parser,
  handlers: AccountChangeHandlers & { setSaving: (saving: boolean) => void },
) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = schema.safeParse(body)

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<unknown>(path, body)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onSaved()
    if (reportLost(handlers, result.status, ACCOUNT_LOST)) return
    const message = ACCOUNT_ERRORS[result.code] ?? ACCOUNT_FAILED
    if (STALE_CODES.includes(result.code)) return handlers.onLost(message)
    setProblem(message)
  }

  return { parsed, problem, submit }
}
