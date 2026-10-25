import { useRef, useState, type KeyboardEvent } from 'react'
import { useUnsavedInput } from '@/lib/leave-guard'
import { TASK_CONTRACT_MESSAGES } from './task-fields'
import { textProblem, type TextField } from './task-table-cells'

type Options = {
  field: TextField
  // 서버가 아는 지금 값(마감이 없으면 빈 글)
  original: string
  busy: boolean
  onSave: (field: TextField, value: string) => Promise<boolean>
  onInvalid: (message: string) => void
}

const cellOf = (element: HTMLElement) => element.closest<HTMLElement>('[role="gridcell"]')

// 날짜를 덜 친 칸은 값이 비어 보인다. 비운 것으로 보내지 않는다.
const draftProblem = (field: TextField, draft: string, input: HTMLInputElement | null) =>
  input?.validity.badInput ? TASK_CONTRACT_MESSAGES.dueDate : textProblem(field, draft)

// Enter로 보낸 뒤 칸으로 돌아온다. 돌아오며 입력칸이 떠나는 것은 이미 보낸 글을 다시 보내지 않는다.
async function enterThenCell(
  committed: Promise<boolean>,
  input: HTMLInputElement,
  skipBlur: { current: boolean },
) {
  const cell = cellOf(input)
  if (!(await committed)) return
  skipBlur.current = true
  cell?.focus()
}

// 글 칸(제목, 마감) 하나의 고치기. draft가 null이면 고치는 중이 아니다.
// Enter나 칸을 떠나면 보내고 Escape는 되돌린다. 보낼 수 없으면(빈 제목, 100자 넘음, 서버 실패) 고치기를 이어 간다.
// 보내지 않은 글이 있는 동안은 떠날 때 묻는다.
export function useTextCell({ field, original, busy, onSave, onInvalid }: Options) {
  const [draft, setDraft] = useState<string | null>(null)
  // Escape로 그만둔 직후의 칸 떠남과, 보내는 중의 칸 떠남은 다시 보내지 않는다.
  const skipBlur = useRef(false)
  const sending = useRef(false)
  useUnsavedInput(draft !== null && draft !== original)

  async function commit(input: HTMLInputElement | null) {
    if (draft === null || sending.current) return true
    if (draft === original) {
      setDraft(null)
      return true
    }
    const problem = draftProblem(field, draft, input)
    if (problem) {
      onInvalid(problem)
      return false
    }
    sending.current = true
    const ok = await onSave(field, draft).finally(() => (sending.current = false))
    if (ok) setDraft(null)
    return ok
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget
    if (event.key === 'Escape') {
      skipBlur.current = true
      setDraft(null)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void enterThenCell(commit(input), input, skipBlur)
    }
  }

  return {
    editing: draft !== null,
    value: draft ?? original,
    start: () => setDraft(original),
    inputProps: {
      readOnly: busy,
      'aria-busy': busy || undefined,
      onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
      onKeyDown,
      onFocus: () => {
        skipBlur.current = false
      },
      onBlur: (event: { currentTarget: HTMLInputElement }) => {
        if (skipBlur.current) skipBlur.current = false
        else void commit(event.currentTarget)
      },
    },
  }
}
