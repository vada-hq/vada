import { useState } from 'react'
import type { ExpenseAction, ExpenseDetail } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ACTION_GONE } from '@/lib/messages'
import { useAskingGuard } from '@/lib/use-asking-guard'
import { ExpenseCancelDialog } from './ExpenseCancelDialog'
import { ExpenseUpdateDialog } from './ExpenseUpdateDialog'
import type { ExpenseDetailState } from './useExpenseDetail'

type Asking = 'cancel' | 'reimburse' | 'update' | null

const NEEDED: Record<Exclude<Asking, null>, ExpenseAction> = {
  cancel: 'expense.cancel',
  reimburse: 'expense.reimburse',
  update: 'expense.update',
}

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
      {actions.includes('expense.update') && (
        <Button variant="outline" disabled={saving} onClick={() => onAsk('update')}>
          고치기
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

type Props = {
  councilId: string
  expense: ExpenseDetail
  detail: ExpenseDetailState
  onForbidden: () => void
}

// 확인 상태와 닫기, 보내기. 열려 있는 동안 다시 읽은 동작에서 그 동작이 빠지면(다른 사람이 취소했거나 행사가 완료됐다) 닫고 이유를 보인다.
// 이미 거절 문구가 있으면(방금 409를 받았다) 그것을 남긴다.
function useAsking(expense: ExpenseDetail, detail: ExpenseDetailState) {
  const [asking, setAsking] = useState<Asking>(null)
  const close = () => {
    detail.report(null)
    setAsking(null)
  }
  const guarded = useAskingGuard(
    asking !== null,
    asking !== null && !expense.actions.includes(NEEDED[asking]) ? 'gone' : null,
    () => {
      setAsking(null)
      detail.report(detail.problem ?? ACTION_GONE)
    },
  )
  const finish = (request: () => Promise<string>) =>
    void guarded(request, result => result !== 'failed').then(result => {
      if (result !== 'failed') setAsking(null)
    })
  return { asking, setAsking, close, finish }
}

// [환급함], [고치기], [취소]는 서버가 준 동작에 있을 때만 보이고, 환급과 취소는 확인을 거친다.
// 이미 바뀐 상태(409)면 확인을 닫고 이유를 버튼 옆에 보인다.
export function ExpenseActions({ councilId, expense, detail, onForbidden }: Props) {
  const { asking, setAsking, close, finish } = useAsking(expense, detail)
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
        onConfirm={() => finish(() => detail.reimburse())}
      />
      {asking === 'cancel' && (
        <ExpenseCancelDialog
          busy={detail.saving}
          error={detail.problem}
          onClose={close}
          onConfirm={reason => finish(() => detail.cancel(reason))}
        />
      )}
      {asking === 'update' && (
        <ExpenseUpdateDialog
          councilId={councilId}
          expense={expense}
          busy={detail.saving}
          error={detail.problem}
          onForbidden={onForbidden}
          onClose={close}
          onConfirm={body => finish(() => detail.update(body))}
        />
      )}
    </div>
  )
}
