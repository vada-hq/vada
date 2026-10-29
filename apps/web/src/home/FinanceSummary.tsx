import { ChevronRight } from 'lucide-react'
import type { HomeFinanceSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { wonLabel } from '../finance/purchase-view'

// 회장단 맨 아래 한 줄. 금액은 재정 개요가 준 그대로이고 클릭하면 재정 첫 화면이다(DEC-92·95).
export default function FinanceSummary({
  summary,
  onOpen,
}: {
  summary?: HomeFinanceSummary | undefined
  onOpen: () => void
}) {
  const overview = summary?.overview
  const missing = summary?.missing ?? []
  const first = missing[0]
  const missingLabel =
    first && `${first.name}${missing.length > 1 ? ` 외 ${missing.length - 1}개` : ''} 예산 미입력`
  return (
    <section aria-label="전체 재정 요약" className={cardClass}>
      <Button
        variant="ghost"
        className="h-auto w-full flex-wrap justify-start gap-x-5 gap-y-2 px-5 py-3 text-left text-sm font-normal break-keep whitespace-normal max-sm:min-h-11"
        onClick={onOpen}
      >
        <span className="font-semibold">전체 재정 요약</span>
        {overview ? (
          <span className="flex flex-1 flex-wrap justify-end gap-x-4 gap-y-2 text-xs text-fg-muted">
            {(
              [
                ['총예산', overview.total],
                ['실제 지출', overview.actual],
                ['지출 예정', overview.committed],
                ['사용 가능', overview.available],
              ] as const
            ).map(([label, amount]) => (
              <span key={label} className="text-right">
                {label}{' '}
                <strong
                  className={`tabular-nums ${label === '사용 가능' && amount < 0 ? 'text-danger-emphasis' : 'text-fg'}`}
                >
                  {wonLabel(amount)}
                </strong>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs text-fg-muted">{summary ? '예산 미입력' : '집계 전'}</span>
        )}
        {missingLabel && (
          <span className="text-xs text-fg-muted wrap-anywhere">{missingLabel}</span>
        )}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      </Button>
    </section>
  )
}
