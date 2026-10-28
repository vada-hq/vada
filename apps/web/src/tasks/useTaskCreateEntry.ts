import { useState } from 'react'
import type { QuickAddContext } from './task-defaults'
import type { TaskCreateInitial } from './task-fields'
import { useTaskOptions } from './useTaskOptions'

type Opened = { initial: TaskCreateInitial; fromQuickAdd: boolean }

// 머리·빈 보드·빠른 추가가 만들기 선택지와 창 상태를 함께 쓴다.
// 창은 서버 만들기 선택지에 부서가 하나라도 있으면 연다(DEC-38). 빠른 추가는 보는 곳의 자리가 없으면 숨지만, 창에서는 부서를 직접 고른다.
export function useTaskCreateEntry(context: QuickAddContext, onForbidden: () => void) {
  const options = useTaskOptions(context.view.council.id, context.eventId, onForbidden)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [title, setTitle] = useState('')
  const choices = options.state.kind === 'ready' ? options.state.options : null
  const available = choices !== null && choices.departments.length > 0
  return {
    context,
    options,
    choices,
    available,
    initial: opened?.initial ?? null,
    // 빠른 추가의 글을 넘겨 연 창인가. 그때만 빠른 추가의 지킴을 창에 넘기고, 만들면 그 글을 비운다.
    detailsOpen: opened?.fromQuickAdd === true,
    title,
    setTitle,
    open: (initial: TaskCreateInitial = {}) => {
      if (available) setOpened({ initial, fromQuickAdd: false })
    },
    openDetails: () => {
      if (available) setOpened({ initial: { title }, fromQuickAdd: true })
    },
    close: () => setOpened(null),
    created: () => {
      if (opened?.fromQuickAdd) setTitle('')
    },
  }
}
