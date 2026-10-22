import { useState } from 'react'
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
  title: string
  description: string
  busy: boolean
  error: string | null
  // 기록마다 계약의 사유 검사를 넘긴다. 길이 숫자를 화면에 다시 적지 않는다.
  isValid: (reason: string) => boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

// 사유를 받아 기록을 취소하는 대화상자(지출, 수입). 취소한 기록은 되살릴 수 없고 사유는 이력에 남는다. [취소하기]는 계약의 검사로 켠다.
export function CancelReasonDialog({
  title,
  description,
  busy,
  error,
  isValid,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby="cancel-reason-description">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="cancel-reason-description">{description}</DialogDescription>
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
          <Button
            variant="destructive"
            disabled={!isValid(reason) || busy}
            onClick={() => onConfirm(reason)}
          >
            취소하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
