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
  // 고를 수 있는 처음과 끝 날(포함). 밖의 날은 보이지만 고르지 못한다(APG Date Picker Dialog).
  min?: string | undefined
  max?: string | undefined
  // 휴대폰 시트에서 날 칸을 44px로 키운다(WCAG 2.5.8, Apple HIG 44pt). 데스크톱 달력은 그대로다.
  touch?: boolean
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

type DayLook = { month: string; value: string | null; today: string; out: boolean; touch: boolean }

function dayClass(day: string, { month, value, today, out, touch }: DayLook) {
  const selected = day === value
  return cn(
    touch ? 'size-11 p-0 text-base font-normal' : 'size-9 p-0 text-sm font-normal',
    (monthOf(day) !== month || out) && 'text-fg-faint',
    out && 'cursor-not-allowed line-through hover:bg-transparent hover:text-fg-faint',
    day === today && !selected && 'font-semibold text-primary-strong ring-1 ring-primary-border',
    selected && 'bg-primary text-primary-foreground hover:bg-primary-strong hover:text-white',
  )
}

function DayButton({
  day,
  focused,
  look,
  onSelect,
}: {
  day: string
  focused: boolean
  look: DayLook
  onSelect: (date: string) => void
}) {
  return (
    <Button
      variant="ghost"
      data-day={day}
      tabIndex={focused ? 0 : -1}
      aria-label={dayLabel(day)}
      aria-pressed={day === look.value}
      aria-current={day === look.today ? 'date' : undefined}
      aria-disabled={look.out || undefined}
      className={dayClass(day, look)}
      onClick={() => {
        if (!look.out) onSelect(day)
      }}
    >
      {Number(day.slice(DAY_FROM))}
    </Button>
  )
}

// 달력을 담은 고르기 창(Popover·Sheet)의 onOpenAutoFocus. 열자마자 고른 날(없으면 오늘)에 초점을 둔다(APG Date Picker Dialog).
// 달력이 스스로 초점을 옮기면 바깥 대화상자의 초점 가두기가 아직 멈추기 전이라 초점을 도로 빼앗긴다. 창이 초점을 넘겨받는 이 때에 옮긴다.
export function focusCalendarDay(event: Event) {
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus()
}

const outside = (day: string, min?: string, max?: string) =>
  (min !== undefined && day < min) || (max !== undefined && day > max)

// 비어 있으면 오늘을, 오늘이 고를 수 있는 기간 밖이면 가까운 끝 날을 처음 보인다.
function startDay(value: string | null, today: string, min?: string, max?: string) {
  if (value) return value
  if (min !== undefined && today < min) return min
  if (max !== undefined && today > max) return max
  return today
}

// 앱 모양의 달력 한 달. 브라우저 기본 날짜 칸은 운영체제마다 모양이 달라 쓰지 않는다.
// 키보드: 화살표로 날을 옮기고(달을 넘으면 달도 넘어간다) Enter나 Space로 고른다. 초점은 한 날에만 둔다(roving tabindex).
export function Calendar({ value, today, onSelect, min, max, touch = false }: Props) {
  const [focused, setFocused] = useState(() => startDay(value, today, min, max))
  const [month, setMonth] = useState(() => monthOf(focused))
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
        <span className="text-sm font-semibold text-fg" aria-live="polite">
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
              <th key={name} scope="col" className="pb-1 text-xs font-normal text-fg-muted">
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
                  <DayButton
                    day={day}
                    focused={day === focused}
                    look={{ month, value, today, out: outside(day, min, max), touch }}
                    onSelect={onSelect}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
