import { useRef, useState } from 'react'
import { CreateTaskSchema, type TaskResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { problemText, reportLost, type TaskDialogHandlers } from './task-requests'

type Handlers = Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'> & {
  onCreated: (task: TaskResponse['task']) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
}

// 업무 만들기 요청. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useTaskCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = CreateTaskSchema.safeParse(request)

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<TaskResponse>(
      `/api/organizations/${encodeURIComponent(councilId)}/tasks`,
      request,
    )
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onCreated(result.data.task)
    if (!reportLost(handlers, result.status)) setProblem(problemText(result.code))
  }

  return { valid: parsed.success, problem, submit }
}
