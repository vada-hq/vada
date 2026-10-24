import { useState } from 'react'
import { RemoveFeePaymentSchema, type FeePaymentMatch } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
    <ConfirmDialog
      title={`${payment.studentId} 학번을 뺄까요?`}
      description={`${payment.paidFrom} ~ ${payment.paidUntil} 납부 기록을 비워요. 이미 신청한 사람의 참가비는 바뀌지 않아요.`}
      confirmLabel="빼기"
      destructive
      busy={saving}
      error={post.problem}
      onConfirm={() => void post.submit()}
      onClose={onClose}
    />
  )
}
