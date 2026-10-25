import { useCallback, useState } from 'react'
import { statusOf, type TaskPerson } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { UNDO_ASSIGNEE_INVALID } from '@/lib/messages'
import { useActive } from '@/lib/use-active'
import { taskAssigneePath } from './task-api'
import { problemText } from './task-requests'

// 담당자를 바꾼 일 하나. previousId는 바꾸기 전 담당자(없으면 null)다.
export type AssigneeChange = {
  taskId: string
  previousId: string | null
  assignee: TaskPerson | null
}

export type UndoBar = AssigneeChange & { busy: boolean; error: string | null }

// 되돌리기 띠의 상태. 마지막 담당자 변경 하나만 남고, 닫거나 되돌리거나 다른 변경이 올 때까지 있다.
// 되돌리기는 이전 값으로 보내는 보통 맡기기다(서버가 10초 안이면 알림을 거두는 쪽이 따로 처리한다).
export function useAssigneeUndo(councilId: string, onDone: () => void, onForbidden: () => void) {
  const [bar, setBar] = useState<UndoBar | null>(null)
  const isActive = useActive()

  const note = useCallback(
    (change: AssigneeChange) => setBar({ ...change, busy: false, error: null }),
    [],
  )
  const dismiss = useCallback(() => setBar(null), [])

  const undo = async () => {
    if (!bar || bar.busy) return
    const { taskId, previousId } = bar
    setBar({ ...bar, busy: true, error: null })
    const result = await postJson(taskAssigneePath(councilId, taskId), { assigneeId: previousId })
    if (result.ok) onDone()
    if (!isActive()) return
    if (result.ok) return setBar(now => (now?.taskId === taskId ? null : now))
    if (result.status === statusOf('FORBIDDEN')) onForbidden()
    const error =
      result.code === 'TASK_ASSIGNEE_INVALID' ? UNDO_ASSIGNEE_INVALID : problemText(result.code)
    // 그 사이 다른 변경으로 띠가 바뀌었으면 그 띠를 건드리지 않는다.
    setBar(now => (now?.taskId === taskId ? { ...now, busy: false, error } : now))
  }
  return { bar, note, dismiss, undo }
}
