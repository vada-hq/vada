import { useCallback, useState } from 'react'
import { statusOf, type TaskDetail, type TaskResponse, type TaskSummary } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { tasksBase } from './task-api'
import { problemText } from './task-requests'

export type TaskEventChange = {
  taskId: string
  previousId: string | null
  event: NonNullable<TaskSummary['event']>
  onRestored?: (task: TaskDetail) => void
}
export type EventUndoBar = TaskEventChange & { busy: boolean; error: string | null }

// 성공 응답에서 행사가 달라졌을 때만 이동으로 알린다.
export function eventChangeOf(before: TaskSummary, after: TaskSummary): TaskEventChange | null {
  if (!after.event || before.event?.id === after.event.id) return null
  return { taskId: after.id, previousId: before.event?.id ?? null, event: after.event }
}

export function useTaskEventUndo(councilId: string, onDone: () => void, onForbidden: () => void) {
  const [bar, setBar] = useState<EventUndoBar | null>(null)
  const isActive = useActive()
  const note = useCallback(
    (change: TaskEventChange) => setBar({ ...change, busy: false, error: null }),
    [],
  )
  const dismiss = useCallback(() => setBar(null), [])
  const undo = async () => {
    if (!bar || bar.busy) return
    const pending = { ...bar, busy: true, error: null }
    setBar(pending)
    const result = await postJson<TaskResponse>(
      `${tasksBase(councilId)}/${encodeURIComponent(bar.taskId)}`,
      {
        eventId: bar.previousId,
      },
    )
    if (result.ok) {
      bar.onRestored?.(result.data.task)
      onDone()
    }
    if (!isActive()) return
    if (result.ok) return setBar(now => (now === pending ? null : now))
    if (result.status === statusOf('FORBIDDEN')) onForbidden()
    setBar(now =>
      now === pending ? { ...now, busy: false, error: problemText(result.code) } : now,
    )
  }
  return { bar, note, dismiss, undo }
}
