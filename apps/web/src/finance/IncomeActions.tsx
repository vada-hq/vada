import { useEffect, useState } from 'react'
import { CancelIncomeSchema, type IncomeDetail } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ACTION_GONE } from '@/lib/messages'
import type { IncomeDetailState } from './useIncomeDetail'

type Props = { income: IncomeDetail; detail: IncomeDetailState }

// [취소]는 서버가 준 동작에 있을 때만 보이고 사유를 거친다. 열려 있는 동안 다시 읽은 동작에서 빠지면
// (다른 사람이 취소했거나 행사가 완료됐거나 결산이 공개됐다) 닫고 이유를 보인다. 방금 받은 거절 문구가 있으면 그것을 남긴다.
export function IncomeActions({ income, detail }: Props) {
  const [asking, setAsking] = useState(false)
  const canCancel = income.actions.includes('income.cancel')
  const gone = asking && !canCancel
  useEffect(() => {
    if (!gone) return
    setAsking(false)
    detail.report(detail.problem ?? ACTION_GONE)
    // 빠졌다는 사실이 바뀔 때만 돈다.
    // oxlint-disable-next-line react/exhaustive-deps -- detail은 매 렌더 새 값이다
  }, [gone])
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
            void detail.cancel(reason).then(outcome => {
              if (outcome !== 'failed') setAsking(false)
            })
          }
        />
      )}
    </div>
  )
}
