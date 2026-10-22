import { useState } from 'react'
import { RemoveFeePaymentSchema, type FeePaymentMatch } from '@vada/contracts'
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
import { feePaymentRemovePath } from './finance-api'
import { useFeePaymentPost, type FeePaymentHandlers } from './useFeePaymentPost'

type Props = FeePaymentHandlers & {
  councilId: string
  payment: FeePaymentMatch
  onDone: () => void
  onClose: () => void
}

// 납부자 빼기 확인. 잘못 올린 학번을 비운다. 이미 정해진 참가비는 바뀌지 않는다.
export function FeePaymentRemoveDialog({
  councilId,
  payment,
  onDone,
  onClose,
  ...handlers
}: Props) {
  const [saving, setSaving] = useState(false)
  const post = useFeePaymentPost<unknown>(
    feePaymentRemovePath(councilId, payment.id),
    {},
    RemoveFeePaymentSchema,
    { ...handlers, setSaving, onDone },
  )
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent aria-describedby="fee-payment-remove">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{payment.studentId} 학번을 뺄까요?</DialogTitle>
          <DialogDescription id="fee-payment-remove">
            {payment.paidFrom} ~ {payment.paidUntil} 납부 기록을 비워요. 이미 신청한 사람의 참가비는
            바뀌지 않아요.
          </DialogDescription>
        </DialogHeader>
        {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            취소
          </Button>
          <Button variant="destructive" disabled={saving} onClick={() => void post.submit()}>
            빼기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
