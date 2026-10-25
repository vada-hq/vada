import { useId } from 'react'
import type { BudgetItemType, BudgetItemUsage } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { signedWon } from './closing-view'
import { wonLabel } from './purchase-view'

type Line = BudgetItemUsage & { purpose: string; amount: number; type: BudgetItemType }

const PERCENT = 100
const percentOf = (part: number, whole: number) => Math.round((part * PERCENT) / whole)

const barClass =
  'absolute inset-0 h-2 w-full appearance-none overflow-hidden rounded-full bg-transparent [&::-webkit-progress-bar]:bg-transparent'

// 실제 지출(진한 파랑) 위에 지출 예정(옅은 파랑)을 이어 그린 막대(와이어프레임 FIN-00 예산 집행률). 배정을 넘으면 가득 찬다.
// 막대 둘을 겹쳐 그린다: 아래는 실제 + 예정, 위는 실제다. 읽는 사람에게는 두 비율을 한 줄로 준다.
function UsageBar({
  amount,
  actual,
  committed,
}: {
  amount: number
  actual: number
  committed: number
}) {
  const label = `실제 지출 ${percentOf(actual, amount)}% · 지출 예정 포함 ${percentOf(actual + committed, amount)}%`
  return (
    <div role="img" aria-label={label} className="relative h-2 w-full rounded-full bg-gray-200">
      <progress
        aria-hidden
        className={cn(
          barClass,
          '[&::-moz-progress-bar]:bg-blue-300 [&::-webkit-progress-value]:bg-blue-300',
        )}
        value={Math.min(actual + committed, amount)}
        max={amount}
      />
      <progress
        aria-hidden
        className={cn(
          barClass,
          '[&::-moz-progress-bar]:bg-blue-600 [&::-webkit-progress-value]:bg-blue-600',
        )}
        value={Math.min(actual, amount)}
        max={amount}
      />
    </div>
  )
}

// 이름과 값 한 칸. 값은 이름으로 읽힌다(aria-labelledby).
function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col">
      <dt id={id} className="text-xs text-gray-500">
        {label}
      </dt>
      <dd aria-labelledby={id} className={cn('text-sm whitespace-nowrap text-gray-800', className)}>
        {value}
      </dd>
    </div>
  )
}

// 지출 항목의 지출 예정과 사용 가능. 수입 항목에는 없다(서버가 null로 준다).
const spendOf = (item: Line) =>
  item.type === 'expense' && item.committed !== null && item.available !== null
    ? { committed: item.committed, available: item.available }
    : null

function Figures({ item, spend }: { item: Line; spend: ReturnType<typeof spendOf> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 @md:grid-cols-4">
      <Figure label="배정" value={wonLabel(item.amount)} />
      <Figure label={spend ? '실제 지출' : '들어온 돈'} value={wonLabel(item.actual)} />
      {spend && (
        <>
          <Figure label="지출 예정" value={wonLabel(spend.committed)} />
          <Figure
            label="사용 가능"
            value={signedWon(spend.available)}
            className={cn('font-semibold', spend.available < 0 ? 'text-red-600' : 'text-blue-700')}
          />
        </>
      )}
    </dl>
  )
}

// 예산 항목 한 줄: 이름, 종류, (있으면) 행사, 막대와 배정·실제 지출·지출 예정·사용 가능(FIN-00 재정 데이터 목록의 열).
// 사용 가능이 음수면 빨강이다. 수입 항목은 배정과 들어온 돈만 있다. 예산 탭과 행사 '예산·정산'이 같은 줄을 쓴다.
export function BudgetItemLine({ item, eventName }: { item: Line; eventName?: string | null }) {
  const spend = spendOf(item)
  return (
    <div className="@container flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">
          {item.purpose}
        </span>
        <Badge tone={spend ? 'neutral' : 'info'}>{spend ? '지출' : '수입'}</Badge>
      </div>
      {eventName && <span className="text-xs text-gray-500 wrap-anywhere">{eventName}</span>}
      {spend && item.amount > 0 && (
        <UsageBar amount={item.amount} actual={item.actual} committed={spend.committed} />
      )}
      <Figures item={item} spend={spend} />
    </div>
  )
}
