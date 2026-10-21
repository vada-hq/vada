import { useState } from 'react'
import { CancelExpenseSchema } from '@vada/contracts'
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
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}

// 지출 취소: 사유를 받아 이력에 남긴다. 취소한 지출은 되살릴 수 없다. [취소하기]는 계약의 검사로 켠다.
export function ExpenseCancelDialog({ busy, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const valid = CancelExpenseSchema.safeParse({ reason }).success
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby="expense-cancel-description">
        <DialogHeader>
          <DialogTitle>이 지출을 취소할까요?</DialogTitle>
          <DialogDescription id="expense-cancel-description">
            취소한 지출은 목록에 &lsquo;취소됨&rsquo;으로 남고 되살릴 수 없어요. 사유는 이력에
            남아요.
          </DialogDescription>
        </DialogHeader>
        <Label className="flex flex-col gap-2">
          취소 사유
          <Textarea
            value={reason}
            disabled={busy}
            onChange={event => setReason(event.target.value)}
          />
        </Label>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          <Button variant="destructive" disabled={!valid || busy} onClick={() => onConfirm(reason)}>
            취소하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
