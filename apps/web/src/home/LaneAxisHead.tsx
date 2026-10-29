import type { HomeEventLane } from '@vada/contracts'
import { eventColorOf } from '@/lib/event-color'
import { cn } from '@/lib/utils'
import { axisDays, TODAY_LINE_HALF, TODAY_LINE_TOP, type Axis } from './lane-axis'

// ② 날짜 머리: 요일(위) + 날짜 숫자 + 그날 다음 일정이 있는 행사 네모(Fantastical 달력 띠의 점).
// 일정이 있는 날만 숫자를 짙게 두어 평소에도 머리가 '일정 있는 날 지도'로 읽힌다. 장식이라 화면 읽기에서 뺀다.
const HALF_STEP = 0.5

function marksOf(lanes: HomeEventLane[], days: number) {
  const marks = new Map<number, string[]>()
  for (const lane of lanes) {
    const day = lane.milestone?.days
    if (day === undefined || day >= days) continue
    marks.set(day, [...(marks.get(day) ?? []), eventColorOf(lane.event.color).solid])
  }
  return marks
}

function dayNumberFace(today: boolean, marked: boolean) {
  if (today) return 'bg-fg font-semibold text-card'
  if (marked) return 'font-semibold text-fg'
  return 'font-normal text-fg-muted'
}

export function LaneAxisHead({
  axis,
  today,
  lanes,
}: {
  axis: Axis
  today: string
  lanes: HomeEventLane[]
}) {
  if (axis.width === 0) return <div aria-hidden className="h-13.5" />
  const marks = marksOf(lanes, axis.days)
  return (
    <div aria-hidden className="relative h-13.5">
      {axisDays(today, axis.days).map(({ day, date, month, weekday }) => {
        const isToday = day === 0
        const monthStart = !isToday && date === 1
        const colors = marks.get(day) ?? []
        return (
          <div
            key={day}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: axis.x(day) - axis.step * HALF_STEP, width: axis.step }}
          >
            <span
              className={cn(
                'text-xs',
                isToday || monthStart ? 'font-semibold text-fg' : 'text-fg-muted',
              )}
            >
              {monthStart ? `${month}월` : weekday}
            </span>
            <span
              className={cn(
                'mt-0.5 flex size-7 items-center justify-center rounded-full text-row-sub leading-none tabular-nums',
                dayNumberFace(isToday, colors.length > 0),
              )}
            >
              {date}
            </span>
            <span className="mt-0.75 flex h-1.25 gap-0.75">
              {colors.map((solid, index) => (
                <span key={index} className={cn('size-1.25 rounded-xs', solid)} />
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 오늘 선: 날짜 원 가운데부터 마지막 행사 줄 막대까지 내려온다.
export function TodayLine({ axis }: { axis: Axis }) {
  if (axis.width === 0) return null
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute w-0.5 bg-fg"
      style={{
        left: axis.x(0) - TODAY_LINE_HALF,
        top: TODAY_LINE_TOP,
        bottom: axis.todayLineBottom,
      }}
    />
  )
}
