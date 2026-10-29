import { cn } from '@/lib/utils'
import type { C2Event } from '../c2-data'
import { axisDays, type Axis } from './axis'
import { eventColorOf, type EventColor } from './event-color'
import {
  AXIS_DAY,
  AXIS_HEAD,
  AXIS_MARK,
  AXIS_MARKS,
  AXIS_WEEKDAY,
  AXIS_WIDE_MIN,
  TODAY_LINE,
  TODAY_LINE_HALF,
  TODAY_LINE_BOTTOM_NARROW,
  TODAY_LINE_BOTTOM_WIDE,
  TODAY_LINE_TOP,
} from './tokens'

// 날짜 머리: 요일(위) + 날짜 숫자 + 그날 일정이 있는 행사 네모(e08 Fantastical 달력 띠의 점).
// 일정이 있는 날만 숫자를 짙게 두고 나머지는 옅게 해, 평소에도 머리가 '빈 달력'이 아니라 '일정 있는 날 지도'로 읽힌다.
// 이 머리는 행사 목록과 같은 흰 묶음 안에 있어 구역 머리 수(K6)에 섞이지 않는다.
const HALF_STEP = 0.5

// 축 안 날짜마다 그날 다음 일정이 있는 행사 색(보이는 차례대로)
function marksOf(events: C2Event[], days: number) {
  const marks = new Map<number, EventColor[]>()
  for (const event of events) {
    const day = event.next?.days
    if (day === undefined || day >= days) continue
    marks.set(day, [...(marks.get(day) ?? []), eventColorOf(event)])
  }
  return marks
}

function dayNumberFace(today: boolean, marked: boolean) {
  if (today) return 'bg-fg font-semibold text-card'
  if (marked) return 'font-semibold text-fg'
  return 'font-normal text-fg-muted'
}

export function AxisHead({ axis, events }: { axis: Axis; events: C2Event[] }) {
  if (axis.width === 0) return <div aria-hidden className={AXIS_HEAD} />
  const marks = marksOf(events, axis.days)
  return (
    <div aria-hidden className={cn('relative', AXIS_HEAD)}>
      {axisDays(axis.days).map(({ day, date, month, weekday }) => {
        const today = day === 0
        const monthStart = !today && date === 1
        const colors = marks.get(day) ?? []
        return (
          <div
            key={day}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: axis.x(day) - axis.step * HALF_STEP, width: axis.step }}
          >
            <span
              className={cn(
                AXIS_WEEKDAY,
                today || monthStart ? 'font-semibold text-fg' : 'text-fg-muted',
              )}
            >
              {monthStart ? `${month}월` : weekday}
            </span>
            <span
              className={cn(
                'mt-0.5 flex items-center justify-center rounded-full tabular-nums',
                AXIS_DAY,
                dayNumberFace(today, colors.length > 0),
              )}
            >
              {date}
            </span>
            <span className={cn('flex', AXIS_MARKS)}>
              {colors.map((color, i) => (
                <span key={`${color.key}-${i}`} className={cn(AXIS_MARK, color.solid)} />
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 오늘 선: 날짜 원 가운데부터 마지막 행사 줄 막대까지 내려온다(e07의 오늘 세로선).
export function TodayLine({ axis }: { axis: Axis }) {
  if (axis.width === 0) return null
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute bg-fg', TODAY_LINE)}
      style={{
        left: axis.x(0) - TODAY_LINE_HALF,
        top: TODAY_LINE_TOP,
        bottom: axis.width >= AXIS_WIDE_MIN ? TODAY_LINE_BOTTOM_WIDE : TODAY_LINE_BOTTOM_NARROW,
      }}
    />
  )
}
