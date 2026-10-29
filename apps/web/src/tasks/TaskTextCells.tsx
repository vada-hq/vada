import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { koreanDateOf, type TaskSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { focusCalendarDay } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { dueLabel } from './task-view'
import { TaskDuePicker } from './TaskDuePicker'
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
        className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium whitespace-normal text-fg wrap-anywhere"
        onClick={props.onOpen}
      >
        {task.title}
      </Button>
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

// 마감 칸. 고칠 수 있으면 글자를 눌러(또는 F2) 업무 상세와 같은 마감 고르기 창(앱 달력)을 열고, 마감 없음이면 비운다. 아니면 글자다.
// 고르면 바로 보내고 닫는다. 닫히면 초점은 칸으로 돌아와 칸 이동 키를 그대로 쓴다.
export function DueCell(props: TextCellProps) {
  const { task } = props
  const [open, setOpen] = useState(false)
  const [today] = useState(() => koreanDateOf(new Date()))
  const trigger = useRef<HTMLButtonElement>(null)
  const text = cn('text-xs text-fg-muted', task.overdue && 'font-medium text-danger-emphasis')
  if (!props.editable) return <span className={text}>{dueLabel(task.dueDate)}</span>
  const pick = (dueDate: string | null) => {
    setOpen(false)
    if (dueDate !== task.dueDate) void props.onSave('dueDate', dueDate ?? '')
  }
  return (
    // 보내는 중에는 열지 않는다(전에는 날짜 칸이 읽기 전용이 되었다).
    <Popover open={open} onOpenChange={next => setOpen(next && !props.busy)}>
      <PopoverTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          tabIndex={-1}
          data-edit-start
          aria-label={`${task.title} 마감 고치기`}
          className={cn(text, 'h-auto justify-start px-1 py-0.5', props.busy && 'opacity-45')}
        >
          {dueLabel(task.dueDate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        aria-label={`${task.title} 마감`}
        onOpenAutoFocus={focusCalendarDay}
        onCloseAutoFocus={event => {
          event.preventDefault()
          trigger.current?.closest<HTMLElement>('[role="gridcell"]')?.focus()
        }}
      >
        <TaskDuePicker value={task.dueDate} today={today} onPick={pick} />
      </PopoverContent>
    </Popover>
  )
}
