import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  dayLabel,
  monthLabel,
  monthOf,
  shiftMonth,
  WEEKDAYS,
  weeksOf,
} from '@/lib/month-grid'
import { cn } from '@/lib/utils'
import { Button } from './button'

type Props = {
  // 골라 둔 날(한국 날짜 'YYYY-MM-DD'). 없으면 오늘이 있는 달을 연다.
  value: string | null
  today: string
  onSelect: (date: string) => void
}

const WEEK = 7
const DAY_FROM = 8
// 화살표로 옮기는 날 수. 위아래는 한 주다(WAI-ARIA APG Date Picker Dialog).
const KEY_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -WEEK,
  ArrowDown: WEEK,
}

function dayClass(day: string, month: string, value: string | null, today: string) {
  const selected = day === value
  return cn(
    'size-9 p-0 text-sm font-normal',
    monthOf(day) !== month && 'text-gray-300',
    day === today && !selected && 'font-semibold text-blue-700 ring-1 ring-blue-200',
    selected && 'bg-primary text-primary-foreground hover:bg-blue-700 hover:text-white',
  )
}

// 앱 모양의 달력 한 달. 브라우저 기본 날짜 칸은 운영체제마다 모양이 달라 쓰지 않는다.
// 키보드: 화살표로 날을 옮기고(달을 넘으면 달도 넘어간다) Enter나 Space로 고른다. 초점은 한 날에만 둔다(roving tabindex).
export function Calendar({ value, today, onSelect }: Props) {
  const [focused, setFocused] = useState(value ?? today)
  const [month, setMonth] = useState(monthOf(value ?? today))
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus()
  }, [focused, month])
  const onKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEP[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = addDays(focused, step)
    moved.current = true
    setFocused(next)
    setMonth(monthOf(next))
  }
  const turn = (by: number) => {
    const next = shiftMonth(month, by)
    setMonth(next)
    setFocused(`${next}-01`)
  }
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="이전 달" onClick={() => turn(-1)}>
          <ChevronLeft />
        </Button>
        <span className="text-sm font-semibold text-gray-900" aria-live="polite">
          {monthLabel(month)}
        </span>
        <Button variant="ghost" size="icon" aria-label="다음 달" onClick={() => turn(1)}>
          <ChevronRight />
        </Button>
      </div>
      <table ref={grid} role="grid" aria-label={monthLabel(month)} onKeyDown={onKeyDown}>
        <thead>
          <tr>
            {WEEKDAYS.map(name => (
              <th key={name} scope="col" className="pb-1 text-xs font-normal text-gray-500">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeksOf(month).map(week => (
            <tr key={week[0]}>
              {week.map(day => (
                <td key={day} className="p-0.5 text-center">
                  <Button
                    variant="ghost"
                    data-day={day}
                    tabIndex={day === focused ? 0 : -1}
                    aria-label={dayLabel(day)}
                    aria-pressed={day === value}
                    aria-current={day === today ? 'date' : undefined}
                    className={dayClass(day, month, value, today)}
                    onClick={() => onSelect(day)}
                  >
                    {Number(day.slice(DAY_FROM))}
                  </Button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
