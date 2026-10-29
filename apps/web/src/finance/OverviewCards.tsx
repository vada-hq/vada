import type { ReactNode } from 'react'
import { ChartColumn, CircleCheck, Clock, Info } from 'lucide-react'
import type { FinanceOverview } from '@vada/contracts'
import { NumberCard } from '@/components/NumberCard'
import { Button } from '@/components/ui/button'
import { headLinkTouch } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { signedWon } from './closing-view'
import { sourcesLabel } from './overview-view'
import { wonLabel } from './purchase-view'

// 카드를 누르면 가는 곳. 예산 탭은 모든 운영진이 읽는다. 링크 이름만 예산을 고칠 수 있는 재정부에게 '편성'(와이어프레임 FIN-00)이고 다른 운영진에게 '내역'이다.
export type OverviewCardLinks = {
  onBudget: () => void
  budgetLabel: '편성' | '내역'
  onSpent: () => void
  onCommitted: () => void
}

// 카드 머리의 아이콘 칸(와이어프레임 FIN-00). 색은 그 카드의 수와 같다.
function IconTile({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-9 items-center justify-center rounded-md [&_svg]:size-4', tone)}
    >
      {children}
    </span>
  )
}

// 390px의 두 칸과 1024px에서 옆 메뉴를 뺀 네 칸 카드에 금액이 한 줄에 들도록 글자를 줄인다.
const valueSize = 'text-lg sm:text-2xl lg:text-xl xl:text-2xl'

// 두 글자 링크라 폭도 키운다. 옆 여백도 음수로 되돌려 글자 자리는 그대로다.
function CardLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="link"
      size="sm"
      className={cn('h-auto p-0 text-xs text-fg-muted max-sm:-mx-3 max-sm:px-3', headLinkTouch)}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

// 카드 넷(DEC-92): 총예산(수입 예산의 합), 실제 지출, 지출 예정, 사용 가능(음수면 빨강).
export function OverviewCards({
  overview,
  links,
}: {
  overview: FinanceOverview
  links: OverviewCardLinks
}) {
  const sources = sourcesLabel(overview.sources)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <NumberCard
        label="총예산"
        icon={
          <IconTile tone="bg-primary-surface text-primary-emphasis">
            <ChartColumn />
          </IconTile>
        }
        link={<CardLink label={links.budgetLabel} onClick={links.onBudget} />}
        value={sources === null ? null : wonLabel(overview.total)}
        valueClassName={`${valueSize} text-primary-emphasis`}
        sub={sources ?? '수입 예산 없음'}
      />
      <NumberCard
        label="실제 지출"
        icon={
          <IconTile tone="bg-success-surface text-success-emphasis">
            <CircleCheck />
          </IconTile>
        }
        link={<CardLink label="내역" onClick={links.onSpent} />}
        value={wonLabel(overview.actual)}
        valueClassName={`${valueSize} text-success-emphasis`}
        sub={`결제 완료 ${overview.paidCount}건`}
      />
      <NumberCard
        label="지출 예정"
        icon={
          <IconTile tone="bg-pending-surface text-pending-emphasis">
            <Clock />
          </IconTile>
        }
        link={<CardLink label="내역" onClick={links.onCommitted} />}
        value={wonLabel(overview.committed)}
        valueClassName={`${valueSize} text-pending-emphasis`}
        sub={`결제 예정 ${overview.committedCount}건`}
      />
      <NumberCard
        label="사용 가능"
        icon={
          <IconTile tone="bg-metric-available-surface text-metric-available">
            <Info />
          </IconTile>
        }
        value={signedWon(overview.available)}
        valueClassName={cn(
          valueSize,
          overview.available < 0 ? 'text-danger-emphasis' : 'text-metric-available',
        )}
        sub="새로 쓸 수 있는 금액"
      />
    </div>
  )
}
