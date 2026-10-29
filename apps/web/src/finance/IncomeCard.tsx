import type { IncomeSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { monthDay } from '@/lib/korean-date-text'
import { SOURCE_LABEL } from './income-view'
import { wonLabel } from './purchase-view'

// 수입 카드: 출처(카드 어디를 눌러도 상세), 내용, 금액, 받은 날과 계좌, 취소됨 칩. 참가비와 이월금은 출처 이름이 곧 표시다.
// 목록의 제목은 화면 제목(h1) 바로 아래라 h2다.
export default function IncomeCard({
  income,
  onOpen,
}: {
  income: IncomeSummary
  onOpen: () => void
}) {
  return (
    <Card className={cn(rowLinkBox, 'flex flex-col gap-2 p-4')}>
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1">
          <Button
            variant="link"
            className={cn(
              'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg wrap-anywhere',
              rowLinkTarget,
            )}
            onClick={onOpen}
          >
            {SOURCE_LABEL[income.source]}
          </Button>
        </h2>
        <span className="text-sm font-semibold whitespace-nowrap text-fg">
          {wonLabel(income.amount)}
        </span>
      </div>
      {income.description && (
        <p className="text-sm wrap-anywhere text-fg-secondary">{income.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span>{monthDay(income.receivedOn)}</span>
        {income.account && <span className="wrap-anywhere">{income.account.name}</span>}
        {income.cancelled && <Badge>취소됨</Badge>}
      </div>
    </Card>
  )
}
