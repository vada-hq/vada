import { useState } from 'react'
import type { ExpenseDetail } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ExpenseCancelDialog } from './ExpenseCancelDialog'
import type { ExpenseDetailState } from './useExpenseDetail'

type Asking = 'cancel' | 'reimburse' | null

function ActionButtons({
  actions,
  saving,
  onAsk,
}: {
  actions: ExpenseDetail['actions']
  saving: boolean
  onAsk: (asking: Asking) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes('expense.reimburse') && (
        <Button disabled={saving} onClick={() => onAsk('reimburse')}>
          환급함
        </Button>
      )}
      {actions.includes('expense.cancel') && (
        <Button variant="outline" disabled={saving} onClick={() => onAsk('cancel')}>
          취소
        </Button>
      )}
    </div>
  )
}

// [환급함]과 [취소]는 서버가 준 동작에 있을 때만 보이고, 확인을 거친다.
// 이미 바뀐 상태(409)면 확인을 닫고 이유를 버튼 옆에 보인다.
export function ExpenseActions({
  expense,
  detail,
}: {
  expense: ExpenseDetail
  detail: ExpenseDetailState
}) {
  const [asking, setAsking] = useState<Asking>(null)
  const close = () => {
    detail.clearProblem()
    setAsking(null)
  }
  const finish = (outcome: Promise<string>) =>
    void outcome.then(result => {
      if (result !== 'failed') setAsking(null)
    })
  return (
    <div className="flex flex-col items-start gap-2">
      <ActionButtons actions={expense.actions} saving={detail.saving} onAsk={setAsking} />
      {asking === null && detail.problem && (
        <StateMessage kind="error">{detail.problem}</StateMessage>
      )}
      <ConfirmDialog
        open={asking === 'reimburse'}
        busy={detail.saving}
        error={detail.problem ?? ''}
        title="환급했다고 표시할까요?"
        description="먼저 낸 사람에게 돈을 돌려준 뒤에 표시하세요. 표시한 뒤에는 되돌릴 수 없어요."
        confirmLabel="환급함"
        onCancel={close}
        onConfirm={() => finish(detail.reimburse())}
      />
      {asking === 'cancel' && (
        <ExpenseCancelDialog
          busy={detail.saving}
          error={detail.problem}
          onClose={close}
          onConfirm={reason => finish(detail.cancel(reason))}
        />
      )}
    </div>
  )
}
