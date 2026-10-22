import { useState } from 'react'
import { CancelIncomeSchema, type IncomeDetail } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ACTION_GONE } from '@/lib/messages'
import { useAskingGuard } from '@/lib/use-asking-guard'
import type { IncomeDetailState, IncomeOutcome } from './useIncomeDetail'

// 취소 요청이 값을 바꿨는가(done), 이미 바뀐 값을 다시 읽게 했는가(stale). failed만 아무것도 바꾸지 못했다.
const isApplied = (outcome: IncomeOutcome) => outcome !== 'failed'

type Props = { income: IncomeDetail; detail: IncomeDetailState }

// [취소]는 서버가 준 동작에 있을 때만 보이고 사유를 거친다. 열려 있는 동안 다시 읽은 동작에서 빠지면
// (다른 사람이 취소했거나 행사가 완료됐거나 결산이 공개됐다) 닫고 이유를 보인다. 방금 받은 거절 문구가 있으면 그것을 남긴다.
export function IncomeActions({ income, detail }: Props) {
  const [asking, setAsking] = useState(false)
  const canCancel = income.actions.includes('income.cancel')
  const guarded = useAskingGuard(asking, canCancel ? null : 'gone', () => {
    setAsking(false)
    detail.report(detail.problem ?? ACTION_GONE)
  })
  const close = () => {
    detail.report(null)
    setAsking(false)
  }
  return (
    <div className="flex flex-col items-start gap-2">
      {canCancel && (
        <Button variant="outline" disabled={detail.saving} onClick={() => setAsking(true)}>
          취소
        </Button>
      )}
      {!asking && detail.problem && <StateMessage kind="error">{detail.problem}</StateMessage>}
      {asking && canCancel && (
        <CancelReasonDialog
          title="이 수입을 취소할까요?"
          description="취소한 수입은 목록에 ‘취소됨’으로 남고 되살릴 수 없어요. 잘못 적었다면 취소하고 다시 적어 주세요. 사유는 이력에 남아요."
          busy={detail.saving}
          error={detail.problem}
          isValid={reason => CancelIncomeSchema.safeParse({ reason }).success}
          onClose={close}
          onConfirm={reason =>
            void guarded(() => detail.cancel(reason), isApplied).then(outcome => {
              if (isApplied(outcome)) setAsking(false)
            })
          }
        />
      )}
    </div>
  )
}
