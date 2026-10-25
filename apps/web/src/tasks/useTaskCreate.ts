import { useRef, useState } from 'react'
import { CreateTaskSchema, statusOf, type TaskResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { taskCreatePath } from './task-api'
import { problemText } from './task-requests'

type Handlers = {
  onCreated: (task: TaskResponse['task']) => void
  onForbidden: () => void
}

// 업무 만들기 요청. 보내는 동안 다시 보내지 않고, 실패하면 그 이유를 problem으로 준다.
// 403이면 권한이 바뀐 것이라 학생회를 다시 읽게 한다.
export function useTaskCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const parsed = CreateTaskSchema.safeParse(request)

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    setBusy(true)
    setProblem(null)
    const result = await postJson<TaskResponse>(taskCreatePath(councilId), request)
    sending.current = false
    setBusy(false)
    if (result.ok) return handlers.onCreated(result.data.task)
    if (result.status === statusOf('FORBIDDEN')) handlers.onForbidden()
    setProblem(
      result.status === statusOf('FORBIDDEN') ? PERMISSION_CHANGED : problemText(result.code),
    )
  }

  return { parsed, problem, busy, submit, setProblem }
}
