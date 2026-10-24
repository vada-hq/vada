import { useState } from 'react'
import { CancelCompletionSchema, CompleteEventSchema } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck } from '@/lib/use-form-check'

type Props = {
  mode: 'complete' | 'cancel'
  // 끝나지 않은 업무 수. 완료는 업무를 막지 않고 알리기만 한다.
  openTasks: number
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string | null) => void
}

// 확인 창에는 그 행동의 결과만 적는다(NN/g, 확인 창은 결과를 구체적으로).
const COPY = {
  complete: {
    title: '이 행사를 완료할까요?',
    reasonLabel: '사유',
    confirm: '완료',
    description: '완료하면 이 행사의 지출, 요청, 참가 신청, 입금을 바꿀 수 없어요.',
  },
  cancel: {
    title: '완료를 취소할까요?',
    reasonLabel: '취소 사유',
    confirm: '완료 취소',
    description: '완료할 때 모은 참가비 수입도 취소돼요.',
  },
}

// 완료 확인(사유는 적을 수만 있다)과 완료 취소(사유가 꼭 있다). [확인]은 끄지 않고 누를 때 확인한다.
// 사유와 보낼 본문, 누를 때 확인. 완료 취소만 사유가 꼭 있다(계약과 같은 규칙).
function useReason(mode: Props['mode']) {
  const [reason, setReason] = useState('')
  const body = mode === 'complete' ? { reason: reason.trim() === '' ? null : reason } : { reason }
  const schema = mode === 'complete' ? CompleteEventSchema : CancelCompletionSchema
  const check = useFormCheck<HTMLDivElement>(() => ({
    reason: mode === 'cancel' ? requiredText(reason, '취소 사유를') : undefined,
  }))
  return { reason, setReason, body, valid: schema.safeParse(body).success, ...check }
}

export function CompletionDialog({ mode, openTasks, busy, error, onClose, onConfirm }: Props) {
  const copy = COPY[mode]
  const { reason, setReason, body, valid, formRef, errors: fieldErrors, attempt } = useReason(mode)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="wrap-anywhere">{copy.description}</DialogDescription>
        </DialogHeader>
        {mode === 'complete' && openTasks > 0 && (
          <StateMessage kind="notice">{`끝나지 않은 업무 ${openTasks}개`}</StateMessage>
        )}
        <div ref={formRef}>
          <Field
            label={copy.reasonLabel}
            optional={mode === 'complete'}
            required={mode === 'cancel'}
            error={fieldErrors.reason}
          >
            <Textarea value={reason} disabled={busy} onChange={e => setReason(e.target.value)} />
          </Field>
        </div>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          <Button
            variant={mode === 'cancel' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => attempt() && valid && onConfirm(body.reason)}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
