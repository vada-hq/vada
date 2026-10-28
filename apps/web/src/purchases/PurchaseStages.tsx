import {
  PURCHASE_STAGES,
  purchaseStageOf,
  type PurchaseRequestSummary,
  type PurchaseStage,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { STATUS_LABEL } from '@/finance/purchase-view'

const STAGE_LABEL: Record<PurchaseStage, string> = {
  pending: STATUS_LABEL.pending,
  unpaid: '결제 전',
  paid: '결제함',
  closed: '반려·취소',
}

export function PurchaseStages({
  requests,
  stage,
  onStage,
}: {
  requests: PurchaseRequestSummary[] | null
  stage: PurchaseStage | undefined
  onStage: (stage: PurchaseStage | null) => void
}) {
  return (
    <div role="group" aria-label="구매 단계 거르기" className="flex flex-wrap gap-2">
      {PURCHASE_STAGES.map(value => {
        const count = requests?.filter(request => purchaseStageOf(request) === value).length
        return (
          <Button
            key={value}
            touch
            size="sm"
            variant={stage === value ? 'secondary' : 'outline'}
            aria-pressed={stage === value}
            className="break-keep"
            onClick={() => onStage(stage === value ? null : value)}
          >
            {STAGE_LABEL[value]}{' '}
            <span className="text-right text-muted-foreground tabular-nums">
              {count === undefined ? '집계 전' : `${count}건`}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
