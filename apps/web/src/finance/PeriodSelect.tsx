import type { FiscalPeriodSummary } from '@vada/contracts'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

// 고른 기간이 없거나 목록에서 사라졌으면 지금 기간, 그것도 없으면 가장 최근 기간이다.
export function chosenPeriod(periods: FiscalPeriodSummary[], chosenId: string | null) {
  return (
    periods.find(period => period.id === chosenId) ??
    periods.find(period => period.current) ??
    periods[0] ??
    null
  )
}

// 수입 탭과 결산 탭이 같이 쓰는 회계 기간 고르기.
export function PeriodSelect({
  periods,
  value,
  onChange,
}: {
  periods: FiscalPeriodSummary[]
  value: string
  onChange: (periodId: string) => void
}) {
  return (
    <Label className="flex flex-col gap-2">
      회계 기간
      <NativeSelect value={value} onChange={event => onChange(event.target.value)}>
        {periods.map(period => (
          <option key={period.id} value={period.id}>
            {period.current ? `${period.name} (지금)` : period.name}
          </option>
        ))}
      </NativeSelect>
    </Label>
  )
}
