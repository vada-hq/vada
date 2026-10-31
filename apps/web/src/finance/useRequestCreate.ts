import { useRef, useState } from 'react'
import { CreatePurchaseRequestSchema, type PurchaseRequestResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CHECK_COMMAND_ID, withCommandId, type CommandMemoRef } from '@/lib/command-id'
import { purchaseCreatePath } from './finance-api'
import { problemText, reportLost, type PurchaseDialogHandlers } from './purchase-requests'

type Handlers = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  onCreated: (request: PurchaseRequestResponse['request']) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
  // 명령 번호. 초안과 함께 남아 새로고침 뒤의 재시도도 같은 번호다. 낸 뒤나 새 작성에는 없다.
  memo: CommandMemoRef
  // 번호가 바뀌면 초안에 남긴다. 응답 전에 새로고침해도 번호가 남도록 보내기 전에 부른다.
  saveMemo: () => void
}

// 요청 내기. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useRequestCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = CreatePurchaseRequestSchema.safeParse({
    ...(request as object),
    commandId: CHECK_COMMAND_ID,
  })
  const forget = () => {
    handlers.memo.current = null
    handlers.saveMemo()
  }

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const { commandId } = withCommandId(handlers.memo, parsed.data)
    handlers.saveMemo()
    const result = await postJson<PurchaseRequestResponse>(purchaseCreatePath(councilId), {
      ...(request as object),
      commandId,
    })
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) {
      forget()
      return handlers.onCreated(result.data.request)
    }
    // 같은 번호에 다른 본문이다. 번호를 버려 다음에 누르면 새 요청으로 간다.
    if (result.code === 'COMMAND_REUSED') forget()
    if (!reportLost(handlers, result.status)) setProblem(problemText(result.code))
  }

  return { valid: parsed.success, parsed, problem, submit }
}
