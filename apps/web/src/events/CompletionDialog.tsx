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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  mode: 'complete' | 'cancel'
  // 끝나지 않은 업무 수. 완료는 업무를 막지 않고 알리기만 한다.
  openTasks: number
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string | null) => void
}

const COPY = {
  complete: {
    title: '이 행사를 완료할까요?',
    reasonLabel: '사유 (선택)',
    confirm: '완료',
    description:
      '완료하면 이 행사의 지출, 요청, 참가 신청, 입금을 바꿀 수 없어요. 참가비는 수입으로 모여요. 회장단이 완료를 취소하면 다시 바꿀 수 있어요.',
  },
  cancel: {
    title: '완료를 취소할까요?',
    reasonLabel: '취소 사유',
    confirm: '완료 취소',
    description: '행사를 다시 열고, 완료할 때 모은 참가비 수입을 취소해요. 사유는 이력에 남아요.',
  },
}

// 완료 확인(사유는 적을 수만 있다)과 완료 취소(사유가 꼭 있다). [확인]은 계약의 검사로 켠다.
export function CompletionDialog({ mode, openTasks, busy, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const copy = COPY[mode]
  const body = mode === 'complete' ? { reason: reason.trim() === '' ? null : reason } : { reason }
  const valid = (mode === 'complete' ? CompleteEventSchema : CancelCompletionSchema).safeParse(
    body,
  ).success
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="wrap-anywhere">{copy.description}</DialogDescription>
        </DialogHeader>
        {mode === 'complete' && openTasks > 0 && (
          <StateMessage kind="notice">
            끝나지 않은 업무가 {openTasks}개 있어요. 업무는 완료해도 계속 바꿀 수 있어요.
          </StateMessage>
        )}
        <Label className="flex flex-col gap-2">
          {copy.reasonLabel}
          <Textarea value={reason} disabled={busy} onChange={e => setReason(e.target.value)} />
        </Label>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          <Button
            variant={mode === 'cancel' ? 'destructive' : 'default'}
            disabled={!valid || busy}
            onClick={() => onConfirm(body.reason)}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
