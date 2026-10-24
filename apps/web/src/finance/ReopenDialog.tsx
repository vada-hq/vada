import { ReopenClosingSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'

type Props = {
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}

// 결산을 다시 여는 창. 사유가 꼭 있고 이력과 이월금 취소에 남는다.
export function ReopenDialog(props: Props) {
  return (
    <CancelReasonDialog
      {...props}
      title="결산을 다시 열까요?"
      description="다시 열면 이 기간의 지출과 수입을 다시 바꿀 수 있고, 다음 기간으로 이월한 돈은 취소돼요. 사유는 이력에 남아요."
      reasonLabel="다시 여는 사유"
      confirmLabel="다시 열기"
      destructive
      parse={reason => ReopenClosingSchema.safeParse({ reason })}
    />
  )
}
