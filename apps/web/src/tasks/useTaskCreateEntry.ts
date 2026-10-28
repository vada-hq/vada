import { useState } from 'react'
import { defaultPlacement, type QuickAddContext } from './task-defaults'
import type { TaskCreateInitial } from './task-fields'
import { useTaskOptions } from './useTaskOptions'

// 머리·빈 보드·빠른 추가가 만들기 선택지와 창 상태를 함께 쓴다.
export function useTaskCreateEntry(context: QuickAddContext, onForbidden: () => void) {
  const options = useTaskOptions(context.view.council.id, context.eventId, onForbidden)
  const [initial, setInitial] = useState<TaskCreateInitial | null>(null)
  const [title, setTitle] = useState('')
  const choices = options.state.kind === 'ready' ? options.state.options : null
  const available = choices !== null && defaultPlacement(choices, context) !== null
  return {
    context,
    options,
    choices,
    available,
    initial,
    title,
    setTitle,
    open: (values: TaskCreateInitial = {}) => {
      if (available) setInitial(values)
    },
    close: () => setInitial(null),
    created: () => setTitle(''),
  }
}
