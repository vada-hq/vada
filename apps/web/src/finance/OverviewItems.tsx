import { useEffect, useRef } from 'react'
import type { FinanceOverview } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BudgetItemList } from './BudgetItemList'
import { wonLabel } from './purchase-view'

// 예산 항목별 현황(navigation.md 작업 40, DEC-92 '예산 항목별 줄을 남긴다'). 칸은 예산 탭·행사 '예산·정산'과 같은 부품이라
// 같은 항목의 숫자와 모양이 같다. 예산 항목 없는 지출은 위 실제 지출에 들어 있고 여기서 한 줄로 보인다.
export function OverviewItems({
  overview,
  onOpen,
  reveal = false,
}: {
  overview: FinanceOverview
  onOpen?: (() => void) | undefined
  reveal?: boolean | undefined
}) {
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (reveal) section.current?.scrollIntoView?.({ block: 'start' })
  }, [reveal])
  const { items, noItem } = overview
  return (
    <section
      ref={section}
      aria-label="예산 항목별 현황"
      className={cn(cardClass, 'flex flex-col gap-3 p-4')}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold break-keep text-fg">예산 항목별 현황</h3>
        {onOpen && (
          <Button variant="outline" className="shrink-0 max-sm:min-h-11" onClick={onOpen}>
            항목 보기
          </Button>
        )}
      </div>
      {items.length === 0 && noItem === 0 ? (
        <StateMessage kind="empty">지출 예산 항목 없음</StateMessage>
      ) : (
        <>
          <BudgetItemList items={items} label="지출 예산 항목" />
          {noItem > 0 && (
            <p className="flex justify-between gap-3 text-sm text-fg-secondary">
              <span>예산 항목 안 정한 지출</span>
              <span className="whitespace-nowrap tabular-nums">{wonLabel(noItem)}</span>
            </p>
          )}
        </>
      )}
    </section>
  )
}
