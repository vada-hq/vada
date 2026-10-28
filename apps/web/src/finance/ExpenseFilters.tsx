import type { ExpenseAllocation, ExpenseSummary, FiscalPeriodView } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { ExpenseFilters as Filters } from './expense-filter'

type Props = {
  // 1024 아래에서 [필터]가 접고 펼친다(ExpenseFilterToggle).
  id?: string
  hidden?: boolean
  expenses: ExpenseSummary[]
  allocations: ExpenseAllocation[]
  periods: FiscalPeriodView[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export function ExpenseFilters({
  id,
  hidden,
  expenses,
  allocations,
  periods,
  filters,
  onChange,
}: Props) {
  const events = new Map(
    expenses.flatMap(row => (row.event ? [[row.event.id, row.event.name]] : [])),
  )
  const items = new Map(
    allocations.flatMap(row =>
      row.budgetItemId && row.purpose && (!filters.period || row.periodId === filters.period.id)
        ? [[row.budgetItemId, row.purpose]]
        : [],
    ),
  )
  return (
    <div id={id} hidden={hidden} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Label className="flex min-w-0 flex-col gap-2">
        회계 기간
        <NativeSelect
          className="max-sm:min-h-11"
          value={filters.period?.id ?? ''}
          onChange={event =>
            onChange({
              ...filters,
              period: periods.find(row => row.id === event.target.value) ?? null,
              budgetItemId: '',
            })
          }
        >
          <option value="">전체 기간</option>
          {periods.map(row => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex min-w-0 flex-col gap-2">
        행사
        <NativeSelect
          className="max-sm:min-h-11"
          value={filters.eventId}
          onChange={event => onChange({ ...filters, eventId: event.target.value })}
        >
          <option value="">전체 행사</option>
          <option value="none">상시</option>
          {[...events].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex min-w-0 flex-col gap-2">
        예산 항목
        <NativeSelect
          className="max-sm:min-h-11"
          value={filters.budgetItemId}
          onChange={event => onChange({ ...filters, budgetItemId: event.target.value })}
        >
          <option value="">전체 항목</option>
          {[...items].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex min-w-0 flex-col gap-2">
        증빙
        <NativeSelect
          className="max-sm:min-h-11"
          value={filters.evidence}
          onChange={event => onChange({ ...filters, evidence: event.target.value })}
        >
          <option value="">전체</option>
          <option value="present">증빙 있음</option>
          <option value="missing">증빙 없음</option>
        </NativeSelect>
      </Label>
      <Label className="flex min-w-0 flex-col gap-2">
        사용처·내역 검색
        <Input
          type="search"
          className="max-sm:min-h-11"
          value={filters.search}
          onChange={event => onChange({ ...filters, search: event.target.value })}
        />
      </Label>
    </div>
  )
}
