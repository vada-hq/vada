import { useState } from 'react'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { tasksBase } from './task-api'
import { problemText, reportLost, type TaskDialogHandlers } from './task-requests'

// 보드 카드 '⋯'의 [지우기]. 확인 창을 거쳐 상세의 지우기와 같은 요청을 보낸다(권한은 카드의 actions에 task.remove가 있을 때, DEC-73).
// 지웠거나 이미 사라졌으면(404) 창을 닫고 목록을 다시 읽는다. 권한을 잃었으면(403) 학생회를 다시 읽는다. 그 밖의 실패는 창 안에 보인다.
export function useTaskRemove(
  councilId: string,
  onDone: () => void,
  handlers: Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'>,
) {
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isActive = useActive()
  const confirm = async () => {
    if (target === null || busy) return
    setBusy(true)
    setError('')
    const result = await postJson(
      `${tasksBase(councilId)}/${encodeURIComponent(target)}/delete`,
      {},
    )
    if (!isActive()) return result.ok ? onDone() : undefined
    setBusy(false)
    if (result.ok || reportLost(handlers, result.status)) {
      setTarget(null)
      onDone()
      return
    }
    setError(problemText(result.code))
  }
  return {
    open: target !== null,
    busy,
    error,
    ask: (taskId: string) => {
      setError('')
      setTarget(taskId)
    },
    close: () => {
      if (!busy) setTarget(null)
    },
    confirm: () => void confirm(),
  }
}
