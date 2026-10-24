import { useState } from 'react'
import { CancelLineItemSchema, type PurchaseLineItem } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { ItemCancel as ItemCancelState } from './useCancelItem'

// 사유 한 칸을 받는 품목 취소 창. 승인 기록은 남고 취소 기록이 한 줄 더해진다.
export function ItemCancelDialog({
  busy,
  error,
  onClose,
  onConfirm,
}: {
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  return (
    <CancelReasonDialog
      destructive
      title="이 품목을 취소할까요?"
      description="취소한 품목은 되살릴 수 없어요."
      reasonLabel="취소 사유"
      confirmLabel="품목 취소"
      busy={busy}
      error={error}
      parse={reason => CancelLineItemSchema.safeParse({ reason })}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}

// [품목 취소]는 서버가 준 품목의 동작에 있을 때만 보인다. 문제는 그 품목의 버튼 옆에 보인다.
export function ItemCancelButton({
  item,
  cancel,
}: {
  item: PurchaseLineItem
  cancel: ItemCancelState
}) {
  const [confirming, setConfirming] = useState(false)
  const problem = cancel.problem?.lineItemId === item.id ? cancel.problem.message : null
  const canCancel = item.actions.includes('line_item.cancel')
  if (!canCancel && !problem) return null
  return (
    <div className="flex flex-col items-start gap-2">
      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          busy={cancel.saving}
          onClick={() => setConfirming(true)}
        >
          품목 취소
        </Button>
      )}
      {!confirming && problem && <StateMessage kind="error">{problem}</StateMessage>}
      {confirming && (
        <ItemCancelDialog
          busy={cancel.saving}
          error={problem}
          onClose={() => {
            cancel.clearProblem()
            setConfirming(false)
          }}
          onConfirm={reason => {
            void cancel.cancelItem(item.id, reason).then(outcome => {
              if (outcome !== 'failed') setConfirming(false)
            })
          }}
        />
      )}
    </div>
  )
}
