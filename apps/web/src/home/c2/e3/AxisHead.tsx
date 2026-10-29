import { cn } from '@/lib/utils'
import { axisDays, type Axis } from './axis'
import {
  AXIS_DAY,
  AXIS_HEAD,
  AXIS_WEEKDAY,
  AXIS_WIDE_MIN,
  TODAY_LINE,
  TODAY_LINE_HALF,
  TODAY_LINE_BOTTOM_NARROW,
  TODAY_LINE_BOTTOM_WIDE,
  TODAY_LINE_TOP,
} from './tokens'

// 날짜 머리: 요일(위) + 날짜 숫자(아래). 오늘은 짙은 원(e08·e09의 오늘 표시), 달이 바뀌는 날은 요일 자리에 '11월'.
// 칸은 날짜 x를 가운데로 한 step 폭이다. 이 머리는 행사 목록과 같은 흰 묶음 안에 있어 구역 머리 수(K6)에 섞이지 않는다.
// 날짜 칸은 날짜 x를 가운데로 둔다
const HALF_STEP = 0.5

export function AxisHead({ axis }: { axis: Axis }) {
  if (axis.width === 0) return <div aria-hidden className={AXIS_HEAD} />
  return (
    <div aria-hidden className={cn('relative', AXIS_HEAD)}>
      {axisDays(axis.days).map(({ day, date, month, weekday }) => {
        const today = day === 0
        const monthStart = !today && date === 1
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
                today ? 'bg-fg font-semibold text-card' : 'font-medium text-fg-secondary',
              )}
            >
              {date}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 오늘 선: 날짜 원 가운데부터 마지막 행사 줄 끝까지 내려온다(e07의 오늘 세로선).
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
