import { useRef, useState } from 'react'
import { CancelMeetingSchema } from '@vada/contracts'
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
import { useFormCheck } from '@/lib/use-form-check'
import { useActive } from '@/lib/use-active'
import { useUnsavedInput } from '@/lib/leave-guard'
import { MEETING_FIELD_ERROR } from './meeting-text'

type Props = { onClose: () => void; onCancel: (reason: string) => Promise<string | null> }
export function MeetingCancelDialog({ onClose, onCancel }: Props) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const active = useActive()
  const release = useUnsavedInput(Boolean(reason.trim()))
  const { formRef, errors, attempt } = useFormCheck(() =>
    CancelMeetingSchema.safeParse({ reason }).success
      ? {}
      : { reason: reason.trim() ? MEETING_FIELD_ERROR : '취소 사유를 입력해 주세요' },
  )
  const close = () => {
    release()
    onClose()
  }
  const submit = async () => {
    if (sending.current || !attempt()) return
    const parsed = CancelMeetingSchema.safeParse({ reason })
    if (!parsed.success) return
    sending.current = true
    setBusy(true)
    const problem = await onCancel(parsed.data.reason)
    sending.current = false
    if (!active()) return
    setBusy(false)
    if (problem) setError(problem)
    else close()
  }
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !sending.current) close()
      }}
    >
      <DialogContent closeDisabled={busy} aria-describedby={undefined} className="break-keep">
        <DialogHeader>
          <DialogTitle>회의 취소</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          className="flex min-w-0 flex-col gap-5"
          onSubmit={event => {
            event.preventDefault()
            void submit()
          }}
        >
          <Field label="취소 사유" required error={errors.reason}>
            <Textarea
              value={reason}
              readOnly={busy}
              onChange={event => {
                setReason(event.target.value)
                setError(null)
              }}
            />
          </Field>
          {error && <StateMessage kind="error">{error}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" touch busy={busy} onClick={close}>
              닫기
            </Button>
            <Button touch busy={busy}>
              회의 취소
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
