import type { FinanceOverview } from '@vada/contracts'
import { TwoPartMeter } from '@/components/TwoPartMeter'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { rateOf } from './overview-view'

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-full ${tone}`} />
      {label}
    </span>
  )
}

// 전체 예산 집행률(와이어프레임 FIN-00): 실제 지출 ÷ 총예산과 지출 예정 포함 비율, 두 겹 막대와 범례.
export function OverviewRate({ overview }: { overview: FinanceOverview }) {
  const { total, actual, committed } = overview
  const spent = rateOf(actual, total)
  const planned = rateOf(actual + committed, total)
  return (
    <section aria-label="전체 예산 집행률" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-fg">
          전체 예산 집행률 {spent === null ? '' : `${spent}%`}
        </span>
        {planned !== null && <span className="text-fg-tertiary">지출 예정 포함 {planned}%</span>}
      </p>
      {spent === null ? (
        <span className="text-sm text-fg-muted">수입 예산 없음</span>
      ) : (
        <>
          <TwoPartMeter
            className="h-3"
            first={actual}
            second={committed}
            max={total}
            labels={{ first: '실제 지출', both: '지출 예정 포함' }}
          />
          <div className="flex gap-4 text-xs text-fg-muted">
            <Legend tone="bg-primary-emphasis" label="실제 지출" />
            <Legend tone="bg-primary-soft" label="지출 예정" />
          </div>
        </>
      )}
    </section>
  )
}
