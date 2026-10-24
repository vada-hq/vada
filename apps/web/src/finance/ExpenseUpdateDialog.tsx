import { useState } from 'react'
import { UpdateExpenseSchema, type ExpenseDetail, type UpdateExpense } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { EXPENSE_OPTIONS_FAILED } from '@/lib/messages'
import { useEvents } from '../events/useEvents'
import { ChoiceSelect } from '../tasks/ChoiceSelect'
import { eventChoices } from '../tasks/task-form-options'

type Props = {
  councilId: string
  expense: ExpenseDetail
  busy: boolean
  error: string | null
  onForbidden: () => void
  onClose: () => void
  onConfirm: (body: UpdateExpense) => void
}

// 바뀐 칸만 보낸다. 비운 사유는 null이다. 아무것도 바뀌지 않았으면 null이다.
function changesOf(expense: ExpenseDetail, reason: string, eventId: string | null) {
  const before = expense.reason ?? ''
  const body: UpdateExpense = {}
  if (reason !== before) body.reason = reason.trim() === '' ? null : reason
  if (eventId !== (expense.event?.id ?? null)) body.eventId = eventId
  return Object.keys(body).length === 0 ? null : body
}

type FieldsProps = {
  councilId: string
  expense: ExpenseDetail
  busy: boolean
  state: { reason: string; eventId: string | null }
  onReason: (reason: string) => void
  onEvent: (eventId: string | null) => void
  onForbidden: () => void
  reasonError: string | undefined
}

// 사유와 행사 칸. 행사는 완료하지 않은 행사만 고른다.
function UpdateFields({
  councilId,
  expense,
  busy,
  state,
  onForbidden,
  reasonError,
  ...on
}: FieldsProps) {
  const events = useEvents(councilId, onForbidden)
  const open =
    events.state.kind === 'ready'
      ? events.state.data.events.filter(item => item.status !== 'completed')
      : []
  return (
    <>
      <Field label="사유" optional error={reasonError}>
        <Textarea
          value={state.reason}
          disabled={busy}
          onChange={e => on.onReason(e.target.value)}
        />
      </Field>
      <ChoiceSelect
        label="행사"
        optional
        choices={eventChoices(open, expense.event)}
        value={state.eventId}
        disabled={busy || events.state.kind !== 'ready'}
        onChange={on.onEvent}
      />
      {events.state.kind === 'failed' && (
        <StateMessage kind="error">{EXPENSE_OPTIONS_FAILED}</StateMessage>
      )}
    </>
  )
}

// 지출 고치기(재정부, 정산 전): 사유와 행사. 행사는 완료하지 않은 행사만 고른다.
// [저장]은 끄지 않는다. 바꾼 것이 없으면 그냥 닫는다.
export function ExpenseUpdateDialog({
  councilId,
  expense,
  busy,
  error,
  onForbidden,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState(expense.reason ?? '')
  const [eventId, setEventId] = useState(expense.event?.id ?? null)
  const body = changesOf(expense, reason, eventId)
  // 계약이 받지 않는 사유(너무 긴 글)는 사유 칸 아래에 보인다.
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck<HTMLDivElement>(() =>
    withContract({}, body === null ? { success: true } : UpdateExpenseSchema.safeParse(body)),
  )
  const save = () => {
    if (body === null) return onClose()
    if (attempt()) onConfirm(body)
  }
  return (
    <Dialog
      open
      onOpenChange={next => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>지출 고치기</DialogTitle>
        </DialogHeader>
        <div ref={formRef} className="flex flex-col gap-4">
          <UpdateFields
            councilId={councilId}
            expense={expense}
            busy={busy}
            state={{ reason, eventId }}
            reasonError={fieldErrors.reason}
            onReason={setReason}
            onEvent={setEventId}
            onForbidden={onForbidden}
          />
        </div>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          <Button disabled={busy} onClick={save}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
