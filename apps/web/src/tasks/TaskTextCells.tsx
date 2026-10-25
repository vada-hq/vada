import { useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'
import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { dueLabel } from './task-view'
import type { TextField } from './task-table-cells'
import { useTextCell } from './useTextCell'

export type TextCellProps = {
  task: TaskSummary
  // 제목·마감을 고칠 수 있는가(task.edit)
  editable: boolean
  busy: boolean
  onOpen: () => void
  onSave: (field: TextField, value: string) => Promise<boolean>
  onInvalid: (message: string) => void
}

const inputClass = 'h-8 py-1 sm:text-xs'

// 고치기가 시작되면 글 칸에 초점을 둔다.
function useFocusOnEdit(editing: boolean) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])
  return ref
}

// 제목 칸. 누르면 상세, 고칠 수 있으면 연필 단추(또는 F2)로 글 칸이 된다.
// 고치는 글 칸은 칸을 옮기는 Tab 순서에 있다. 떠나면 보내므로 Tab으로 나가도 된다.
export function TitleCell(props: TextCellProps) {
  const { task } = props
  const edit = useTextCell({
    field: 'title',
    original: task.title,
    busy: props.busy,
    onSave: props.onSave,
    onInvalid: props.onInvalid,
  })
  const inputRef = useFocusOnEdit(edit.editing)
  if (edit.editing)
    return (
      <Input
        ref={inputRef}
        aria-label={`${task.title} 제목`}
        className={cn(inputClass, props.busy && 'opacity-45')}
        value={edit.value}
        {...edit.inputProps}
      />
    )
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button
        variant="link"
        tabIndex={-1}
        className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 wrap-anywhere"
        onClick={props.onOpen}
      >
        {task.title}
      </Button>
      {task.status === 'in_progress' && <Badge tone="info">진행 중</Badge>}
      {props.editable && (
        <Button
          variant="ghost"
          size="icon"
          tabIndex={-1}
          data-edit-start
          aria-label={`${task.title} 제목 고치기`}
          className="p-1"
          onClick={edit.start}
        >
          <Pencil aria-hidden />
        </Button>
      )}
    </div>
  )
}

// 마감 칸. 고칠 수 있으면 글자를 눌러(또는 F2) 날짜 칸으로 고치고, 비우면 '마감 없음'이다. 아니면 글자다.
export function DueCell(props: TextCellProps) {
  const { task } = props
  const edit = useTextCell({
    field: 'dueDate',
    original: task.dueDate ?? '',
    busy: props.busy,
    onSave: props.onSave,
    onInvalid: props.onInvalid,
  })
  const inputRef = useFocusOnEdit(edit.editing)
  const text = cn('text-xs text-gray-500', task.overdue && 'font-medium text-red-600')
  if (edit.editing)
    return (
      <Input
        ref={inputRef}
        type="date"
        aria-label={`${task.title} 마감`}
        className={cn(inputClass, props.busy && 'opacity-45')}
        value={edit.value}
        {...edit.inputProps}
      />
    )
  if (!props.editable) return <span className={text}>{dueLabel(task.dueDate)}</span>
  return (
    <Button
      variant="ghost"
      tabIndex={-1}
      data-edit-start
      aria-label={`${task.title} 마감 고치기`}
      className={cn(text, 'h-auto justify-start px-1 py-0.5')}
      onClick={edit.start}
    >
      {dueLabel(task.dueDate)}
    </Button>
  )
}
