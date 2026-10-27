import { useState, type KeyboardEvent } from 'react'
import { UpdateTaskSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isComposingKey } from '@/lib/composing-key'
import { requiredText, withContract } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'

// 제목과 설명은 그 자리에서 고친다. 따로 [고치기] 화면을 열지 않는다(Linear·Notion·Jira 상세, Atlassian "Inline edit" 패턴).
// 칸을 떠나면 저장하고, Esc는 고치기 전으로 돌아간다. 패널이 Esc로 닫히지 않게 칸에 data-inline-edit를 둔다(TaskDetailFrame이 본다).
type Field = 'title' | 'body'

type Props = {
  field: Field
  value: string | null
  editable: boolean
  busy: boolean
  // 서버가 거절한 이유
  problem?: string | undefined
  // 바꾼 값을 보낸다. 성공하면 true.
  onSave: (value: string | null) => Promise<boolean> | boolean
}

// 칸 확인: 제목은 비울 수 없고, 길이 상한은 계약이 판단한다(숫자를 화면에 다시 적지 않는다).
function checkOf(field: Field, text: string) {
  const request = field === 'title' ? { title: text } : { body: text.trim() === '' ? null : text }
  const own = field === 'title' ? { title: requiredText(text, '제목을') } : {}
  return withContract(own, UpdateTaskSchema.safeParse(request))[field]
}

const SHOWN: Record<Field, string> = {
  title: 'text-lg leading-snug font-semibold text-gray-900',
  body: 'text-sm leading-relaxed text-gray-800 whitespace-pre-wrap',
}

function useInlineEdit({ field, value, onSave }: Pick<Props, 'field' | 'value' | 'onSave'>) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const cancel = () => {
    setDraft(null)
    setError(undefined)
  }
  const commit = async () => {
    if (draft === null) return
    const next = field === 'body' && draft.trim() === '' ? null : draft
    if (next === value) return cancel()
    const problem = checkOf(field, draft)
    if (problem) return setError(problem)
    if (await onSave(next)) cancel()
  }
  return { draft, setDraft, error, cancel, commit, start: () => setDraft(value ?? '') }
}

const LABEL: Record<Field, string> = { title: '제목', body: '설명' }
// 고치는 칸의 줄 수: 제목은 두 줄이면 다 보이고, 설명은 몇 줄을 쓴다.
const ROWS: Record<Field, number> = { title: 2, body: 5 }

// 제목은 Enter, 설명은 줄바꿈이 있어 Ctrl·⌘ + Enter로 저장한다. 한글 조합 중의 키는 받지 않는다.
function keyHandler(field: Field, edit: ReturnType<typeof useInlineEdit>) {
  return (event: KeyboardEvent) => {
    if (isComposingKey(event)) return
    if (event.key === 'Escape') return edit.cancel()
    const submit = field === 'title' ? !event.shiftKey : event.ctrlKey || event.metaKey
    if (event.key !== 'Enter' || !submit) return
    event.preventDefault()
    void edit.commit()
  }
}

function Editing({
  field,
  busy,
  problem,
  edit,
}: Pick<Props, 'field' | 'busy' | 'problem'> & { edit: ReturnType<typeof useInlineEdit> }) {
  const message = edit.error ?? problem
  return (
    <div className="flex flex-col gap-1">
      <Textarea
        data-inline-edit
        aria-label={LABEL[field]}
        autoFocus
        rows={ROWS[field]}
        value={edit.draft ?? ''}
        disabled={busy}
        aria-invalid={edit.error ? true : undefined}
        className={cn(
          SHOWN[field],
          'min-h-0 resize-none whitespace-normal',
          // 입력칸의 sm:text-sm이 제목 크기를 덮지 않게 한다.
          field === 'title' && 'sm:text-lg',
        )}
        onChange={event => edit.setDraft(event.target.value)}
        onBlur={() => void edit.commit()}
        onKeyDown={keyHandler(field, edit)}
      />
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
  )
}

function Shown({
  field,
  value,
  busy,
  problem,
  onStart,
}: Pick<Props, 'field' | 'value' | 'busy' | 'problem'> & { onStart: () => void }) {
  const empty = `${LABEL[field]} 추가`
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        busy={busy}
        aria-label={value ? undefined : empty}
        className={cn(
          SHOWN[field],
          '-mx-2 h-auto justify-start px-2 py-1 text-left whitespace-pre-wrap wrap-anywhere hover:bg-gray-100 hover:text-gray-900',
          field === 'body' && 'font-normal',
          !value && 'text-gray-400',
        )}
        onClick={onStart}
      >
        {value ?? empty}
      </Button>
      {problem && <StateMessage kind="error">{problem}</StateMessage>}
    </div>
  )
}

export function TaskInlineText({ field, value, editable, busy, problem, onSave }: Props) {
  const edit = useInlineEdit({ field, value, onSave })
  if (edit.draft !== null)
    return <Editing field={field} busy={busy} problem={problem} edit={edit} />
  if (editable)
    return <Shown field={field} value={value} busy={busy} problem={problem} onStart={edit.start} />
  return value ? <p className={cn(SHOWN[field], 'wrap-anywhere')}>{value}</p> : null
}
