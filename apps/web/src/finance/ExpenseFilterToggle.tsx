import { useId, useState, type ComponentProps } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activeFilterCount } from './expense-filter'
import { ExpenseFilters } from './ExpenseFilters'

// 1024 아래 사용 내역의 필터 칸 다섯. 펼치면 요약과 목록이 첫 화면 밖으로 밀리므로(390에서 약 400px) [필터] 하나로 접고,
// 고른 칸이 있으면 그 수를 붙인다(FIN-LEDGER-01 차례: 요약 → 찾기 → 목록, 행사 '행사 기본정보' 펼치기와 같은 꼴).
export function ExpenseFilterToggle(props: ComponentProps<typeof ExpenseFilters>) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const count = activeFilterCount(props.filters)
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        touch
        className="self-start"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal aria-hidden />
        필터 {count > 0 && <span className="text-primary-strong tabular-nums">{count}</span>}
      </Button>
      <ExpenseFilters {...props} id={id} hidden={!open} />
    </div>
  )
}
