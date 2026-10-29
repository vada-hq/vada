import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { C2Event } from '../c2-data'
import type { Axis } from './axis'
import { mix, type EventColor } from './event-color'
import {
  BAR_STOPS,
  DIAMOND,
  DIAMOND_LIFT,
  DIAMOND_MIN,
  LANE_BAR,
  LANE_TEXT,
  NAME_GAP,
  ONGOING_FROM,
  SEGMENT,
  TICK,
  TICK_HALF,
  TODAY_NODE,
} from './tokens'

const CENTER_Y = 'top-1/2 -translate-y-1/2'

const PERCENT = 100
// 날짜 자리 x의 막대 진하기(모든 줄이 같은 자를 쓴다): BAR_STOPS 사이를 곧게 잇는다
function alphaAt(axis: Axis, x: number) {
  const t = (x - axis.x(0)) / Math.max(1, axis.width - axis.x(0))
  const after = BAR_STOPS.findIndex(([at]) => at >= t)
  if (after <= 0) return BAR_STOPS[0]?.[1] ?? 1
  const [t0, a0] = BAR_STOPS[after - 1] ?? [0, 1]
  const [t1, a1] = BAR_STOPS[after] ?? [1, 1]
  return a0 + ((a1 - a0) * (t - t0)) / Math.max(Number.EPSILON, t1 - t0)
}

const fadeOf = (color: EventColor) =>
  `linear-gradient(to right, ${BAR_STOPS.map(([at, alpha]) => `${mix(color, alpha)} ${at * PERCENT}%`).join(', ')})`

// 다음 일정 글 'D-2 신청 마감'. 줄마다 이름과 같은 x에서 시작해 위에서 아래로 훑인다(1순위).
function NextText({ event }: { event: C2Event }) {
  if (!event.next) return <span className="text-fg-tertiary">{event.nextText}</span>
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="font-bold text-fg tabular-nums">{event.next.dday}</span>
      <span className="text-fg-secondary">{event.next.name}</span>
    </span>
  )
}

// 창 밖 일정: 막대는 축 끝에서 끊기고, 그 위 오른쪽 끝에 '11월 6일 (금) →'(977 14일·358 7일 같은 원리)
function OutDate({ event }: { event: C2Event }) {
  return (
    <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-fg-tertiary">
      {event.next?.dateText}
      <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
    </span>
  )
}

// 막대: 오늘 점 → 다음 일정(창 밖이면 축 끝). 진하기는 날짜 자리를 따라 오늘 쪽이 진하다.
function Segment({
  event,
  axis,
  color,
  end,
}: {
  event: C2Event
  axis: Axis
  color: EventColor
  end: number
}) {
  const start = axis.x(0)
  const from = axis.gutter * ONGOING_FROM
  // 그라데이션 길이를 축 전체(오늘 → 축 끝)로 두고 막대 길이만큼만 보이게 한다
  const fade = fadeOf(color)
  return (
    <>
      {event.ongoing && (
        <span
          aria-hidden
          className={cn('absolute rounded-l-full', CENTER_Y, SEGMENT)}
          style={{
            left: from,
            width: start - from,
            backgroundImage: `linear-gradient(to right, transparent, ${mix(color, alphaAt(axis, start))})`,
          }}
        />
      )}
      <span
        aria-hidden
        className={cn('absolute', CENTER_Y, SEGMENT, !event.ongoing && 'rounded-l-full')}
        style={{
          left: start,
          width: Math.max(0, end - start),
          backgroundImage: fade,
          backgroundSize: `${axis.width - start}px 100%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </>
  )
}

function Diamond({ axis, x, color }: { axis: Axis; x: number; color: EventColor }) {
  const alpha = Math.max(DIAMOND_MIN, alphaAt(axis, x) + DIAMOND_LIFT)
  return (
    <span
      aria-hidden
      className={cn('absolute -translate-x-1/2 rotate-45 rounded-[2px]', CENTER_Y, DIAMOND)}
      style={{ left: x, backgroundColor: mix(color, alpha) }}
    />
  )
}

// 하루 눈금(막대 뒤)
function Ticks({ axis }: { axis: Axis }) {
  return Array.from({ length: axis.days - 1 }, (_, i) => i + 1).map(day => (
    <span
      key={day}
      aria-hidden
      className={cn('absolute bg-border', CENTER_Y, TICK)}
      style={{ left: axis.x(day) - TICK_HALF }}
    />
  ))
}

// 막대 칸: 하루 눈금 / 오늘 점 → 다음 일정 막대 / 마름모
function Bar({ event, axis, color }: { event: C2Event; axis: Axis; color: EventColor }) {
  const day = event.next?.days ?? 0
  const out = event.next !== null && day > axis.days - 1
  return (
    <div className={cn('relative', LANE_BAR)}>
      <Ticks axis={axis} />
      {event.next && (
        <Segment event={event} axis={axis} color={color} end={out ? axis.width : axis.x(day)} />
      )}
      <span
        aria-hidden
        className={cn('absolute -translate-x-1/2 rounded-full bg-fg', CENTER_Y, TODAY_NODE)}
        style={{ left: axis.x(0) }}
      />
      {event.next && !out && <Diamond axis={axis} x={axis.x(day)} color={color} />}
    </div>
  )
}

// 선로: 위 일정 글 줄(이름과 같은 x에서 시작, 창 밖이면 오른쪽 끝에 날짜) + 아래 막대 칸
export function Lane({ event, axis, color }: { event: C2Event; axis: Axis; color: EventColor }) {
  if (axis.width === 0) return <div className={LANE_TEXT} />
  const out = event.next !== null && event.next.days > axis.days - 1
  return (
    <div>
      <div
        className={cn('flex items-center', LANE_TEXT)}
        style={{ paddingLeft: axis.x(0) + NAME_GAP }}
      >
        <NextText event={event} />
        {out && <OutDate event={event} />}
      </div>
      <Bar event={event} axis={axis} color={color} />
    </div>
  )
}
