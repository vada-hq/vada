import { useRef, useState, type ReactNode } from 'react'
import type { ScheduleItemDetail, UpdateScheduleItemRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFormCheck } from '@/lib/use-form-check'
import { useActive } from '@/lib/use-active'
import { ScheduleChoiceFields } from './ScheduleChoiceFields'
import { ScheduleFields } from './ScheduleFields'
import {
  initialSchedule,
  parseSchedule,
  scheduleErrors,
  type ScheduleChoice,
  type ScheduleForm,
  type ScheduleSaveProblem,
} from './schedule-form'

type Props = {
  initialDate: string
  item?: ScheduleItemDetail | undefined
  departments: ScheduleChoice[]
  events: ScheduleChoice[]
  optionsNotice?: ReactNode
  showErrors?: boolean
  onSave: (body: UpdateScheduleItemRequest) => Promise<ScheduleSaveProblem | null>
  onClose: () => void
}

function useScheduleForm({
  initialDate,
  item,
  showErrors,
  onSave,
}: Pick<Props, 'initialDate' | 'item' | 'showErrors' | 'onSave'>) {
  const [value, setValue] = useState(() => initialSchedule(initialDate, item))
  const [problem, setProblem] = useState<ScheduleSaveProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const active = useActive()
  const form = useFormCheck(() => scheduleErrors(value, Boolean(item)))
  const onChange = (patch: Partial<ScheduleForm>) => {
    setValue(before => ({ ...before, ...patch }))
    setProblem(null)
  }
  const save = async () => {
    if (sending.current || !form.attempt()) return
    const parsed = parseSchedule(value, Boolean(item))
    if (!parsed.success) return
    sending.current = true
    setBusy(true)
    const error = await onSave(parsed.data)
    sending.current = false
    if (!active()) return
    setBusy(false)
    setProblem(error)
    if (error?.departmentId)
      requestAnimationFrame(() =>
        form.formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
  }
  const fields = {
    value,
    errors: { ...(showErrors ? scheduleErrors(value, Boolean(item)) : form.errors), ...problem },
    onChange,
  }
  return { fields, formRef: form.formRef, save, busy, sending }
}

export function ScheduleDialog(props: Props) {
  const { item, departments, events, optionsNotice, onClose } = props
  const { fields, formRef, save, busy, sending } = useScheduleForm(props)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !sending.current) onClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        closeDisabled={busy}
        className="break-keep [&>button]:max-sm:min-h-11 [&>button]:max-sm:min-w-11"
      >
        <DialogHeader>
          <DialogTitle>{item ? '일정 수정' : '일정 추가'}</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          className="flex min-w-0 flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            void save()
          }}
        >
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <ScheduleFields {...fields} />
            <ScheduleChoiceFields
              {...fields}
              departments={departments}
              events={events}
              optionsNotice={optionsNotice}
            />
          </fieldset>
          {fields.errors.form && <StateMessage kind="error">{fields.errors.form}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" touch busy={busy} onClick={onClose}>
              닫기
            </Button>
            <Button touch busy={busy}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
