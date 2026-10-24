import { useState } from 'react'
import { statusOf } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { taskAssigneePath } from './task-api'
import { problemText } from './task-requests'

// 목록 줄에서 담당자 정하기(요구 15). 상태 바꾸기(useStatusChange)와 같이, 보내는 동안 그 줄을 막고 실패는 그 줄에 남긴다.
export function useTaskAssign(councilId: string, onDone: () => void, onForbidden: () => void) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const isActive = useActive()
  const assign = async (taskId: string, assigneeId: string) => {
    if (busy.has(taskId)) return
    setBusy(before => new Set(before).add(taskId))
    setErrors(before => Object.fromEntries(Object.entries(before).filter(([id]) => id !== taskId)))
    const result = await postJson(taskAssigneePath(councilId, taskId), { assigneeId })
    if (!isActive()) return result.ok ? onDone() : undefined
    setBusy(before => {
      const next = new Set(before)
      next.delete(taskId)
      return next
    })
    if (!result.ok) {
      setErrors(before => ({ ...before, [taskId]: problemText(result.code) }))
      if (result.status === statusOf('FORBIDDEN')) onForbidden()
    }
    onDone()
  }
  return { busy, errors, assign }
}
