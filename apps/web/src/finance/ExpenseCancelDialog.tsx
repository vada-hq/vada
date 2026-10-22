import { CancelExpenseSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'

type Props = {
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}

// 지출 취소: 사유를 받아 이력에 남긴다. 취소한 지출은 되살릴 수 없다.
export function ExpenseCancelDialog(props: Props) {
  return (
    <CancelReasonDialog
      {...props}
      title="이 지출을 취소할까요?"
      description="취소한 지출은 목록에 ‘취소됨’으로 남고 되살릴 수 없어요. 사유는 이력에 남아요."
      isValid={reason => CancelExpenseSchema.safeParse({ reason }).success}
    />
  )
}
