import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import type { TaskStatus, TaskSummary } from '@vada/contracts'
import { STATUS_LABEL } from './task-view'
import type { useStatusChange } from './useStatusChange'

type Source = { id: string; status: TaskStatus }
export type TaskCardDrag = {
  enabled: boolean
  active: boolean
  start: (event: DragEvent<HTMLLIElement>) => boolean
  end: () => void
}

function useDragSource() {
  const source = useRef<Source | null>(null)
  const suppressClick = useRef(false)
  const [dragged, setDragged] = useState<Source | null>(null)
  const start = (task: TaskSummary, event: DragEvent<HTMLLIElement>) => {
    source.current = { id: task.id, status: task.status }
    suppressClick.current = true
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
    setDragged(source.current)
    return true
  }
  // 다른 열로 옮기면 카드가 새로 마운트되므로, 드래그 뒤 클릭 차단은 보드에 둔다.
  const clickGuard = {
    onPointerDownCapture: () => {
      suppressClick.current = false
    },
    onKeyDownCapture: () => {
      suppressClick.current = false
    },
    onClickCapture: (event: MouseEvent) => {
      if (suppressClick.current) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
  }
  const clear = () => {
    source.current = null
    setDragged(null)
  }
  return { source, dragged, start, clear, clickGuard }
}

// 상태 열 사이에서만 옮긴다. 데이터는 기존 저장·재조회가 바꾸며 카드 순서를 저장하지 않는다.
export function useTaskDrag(tasks: TaskSummary[], change: ReturnType<typeof useStatusChange>) {
  const drag = useDragSource()
  const [over, setOver] = useState<TaskStatus | null>(null)
  const allowed = (task: TaskSummary) =>
    task.actions.includes('task.change_status') && !change.busy.has(task.id)
  const targetAllowed = (status: TaskStatus) => {
    const task = tasks.find(item => item.id === drag.source.current?.id)
    return (
      task && allowed(task) && task.status === drag.source.current?.status && task.status !== status
    )
  }
  const end = () => {
    drag.clear()
    setOver(null)
  }
  const card = (task: TaskSummary): TaskCardDrag => ({
    enabled: allowed(task),
    active: drag.dragged?.id === task.id,
    end,
    start: event => {
      if (allowed(task)) return drag.start(task, event)
      event.preventDefault()
      return false
    },
  })
  const column = (status: TaskStatus) => ({
    available: !!drag.dragged && !!targetAllowed(status),
    active: over === status && !!targetAllowed(status),
    label: `여기에 놓아 ${STATUS_LABEL[status]}${status === 'todo' ? '로' : '으로'} 변경`,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!targetAllowed(status)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setOver(status)
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!targetAllowed(status)) return end()
      event.preventDefault()
      const id = drag.source.current!.id
      end()
      void change.change(id, status)
    },
  })
  return { card, column, clickGuard: drag.clickGuard }
}
