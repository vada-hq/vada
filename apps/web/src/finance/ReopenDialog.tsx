import { useState } from 'react'
import { ReopenClosingSchema } from '@vada/contracts'
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

// 결산을 다시 여는 대화상자. 사유가 꼭 있고 이력과 이월금 취소에 남는다. [다시 열기]는 계약의 검사로 켠다.
export function ReopenDialog({ busy, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent aria-describedby="reopen-description">
        <DialogHeader>
          <DialogTitle>결산을 다시 열까요?</DialogTitle>
          <DialogDescription id="reopen-description">
            다시 열면 이 기간의 지출과 수입을 다시 바꿀 수 있고, 다음 기간으로 이월한 돈은 취소돼요.
            사유는 이력에 남아요.
          </DialogDescription>
        </DialogHeader>
        <Label className="flex flex-col gap-2">
          다시 여는 사유
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
            disabled={!ReopenClosingSchema.safeParse({ reason }).success || busy}
            onClick={() => onConfirm(reason)}
          >
            다시 열기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
