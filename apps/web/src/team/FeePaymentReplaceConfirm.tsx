import { ConfirmDialog } from '@/components/ConfirmDialog'

export function FeePaymentReplaceConfirm(props: {
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      touch
      title="납부자 명단 바꾸기"
      confirmLabel="바꾸기"
      description="같은 기간의 명단을 바꿔요. 새 명단에 없는 학번은 비우고, 이미 신청한 사람의 참가비는 그대로예요."
      {...props}
    />
  )
}
