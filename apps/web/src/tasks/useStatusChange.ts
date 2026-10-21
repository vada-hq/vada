import { useState } from 'react'
import { statusOf, type TaskStatus } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { TASK_STATUS_ERRORS, TASK_STATUS_FAILED } from '@/lib/messages'
import { taskStatusPath } from './task-api'

// 카드의 상태 바꾸기. 보내는 동안 그 업무의 버튼을 막고(두 번 누름 금지), 실패는 그 카드에 문구로 남긴다.
// 끝나면 목록을 다시 읽는다(성공이든, 이미 지워졌든). 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useStatusChange(councilId: string, onDone: () => void, onForbidden: () => void) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const isActive = useActive()
  const change = async (taskId: string, status: TaskStatus) => {
    if (busy.has(taskId)) return
    setBusy(before => new Set(before).add(taskId))
    setErrors(before => Object.fromEntries(Object.entries(before).filter(([id]) => id !== taskId)))
    const result = await postJson(taskStatusPath(councilId, taskId), { status })
    if (!isActive()) return
    setBusy(before => {
      const next = new Set(before)
      next.delete(taskId)
      return next
    })
    if (!result.ok) {
      const message = TASK_STATUS_ERRORS[result.code] ?? TASK_STATUS_FAILED
      setErrors(before => ({ ...before, [taskId]: message }))
      if (result.status === statusOf('FORBIDDEN')) onForbidden()
    }
    onDone()
  }
  return { busy, errors, change }
}
