import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { INCOME_LOAD_FAILED } from '@/lib/messages'
import { IncomeActions } from './IncomeActions'
import { IncomeFacts, IncomeRecords } from './IncomeFacts'
import type { IncomeDialogHandlers } from './income-requests'
import { SOURCE_LABEL } from './income-view'
import { useIncomeDetail } from './useIncomeDetail'

type Props = IncomeDialogHandlers & {
  councilId: string
  // 열린 수입의 번호. null이면 닫혀 있다.
  incomeId: string | null
  onClose: () => void
}

// 수입 상세 대화상자. 열려 있을 때만 읽고, 수입이 바뀌면 처음부터 다시 읽는다.
export function IncomeDetailDialog({ incomeId, ...props }: Props) {
  if (incomeId === null) return null
  return <OpenIncomeDialog key={incomeId} incomeId={incomeId} {...props} />
}

function OpenIncomeDialog({
  councilId,
  incomeId,
  onClose,
  ...handlers
}: Props & { incomeId: string }) {
  const detail = useIncomeDetail(councilId, incomeId, handlers)
  const { income } = detail
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !detail.saving) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {income ? SOURCE_LABEL[income.source] : '수입'}
          </DialogTitle>
        </DialogHeader>
        {income ? (
          <div className="flex flex-col gap-6">
            <IncomeFacts income={income} />
            <IncomeActions income={income} detail={detail} />
            <IncomeRecords income={income} />
          </div>
        ) : detail.loadFailed ? (
          <div className="flex flex-col items-start gap-3">
            <StateMessage kind="error">{INCOME_LOAD_FAILED}</StateMessage>
            <Button variant="outline" onClick={detail.retry}>
              다시 시도
            </Button>
          </div>
        ) : (
          <StateMessage kind="loading">불러오는 중이에요</StateMessage>
        )}
      </DialogContent>
    </Dialog>
  )
}
