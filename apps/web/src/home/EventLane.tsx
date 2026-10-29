import { ArrowRight } from 'lucide-react'
import type { HomeEventLane } from '@vada/contracts'
import { mixColor, type EventColor } from '@/lib/event-color'
import { cn } from '@/lib/utils'
import { NO_MILESTONE_TEXT, milestoneText } from './event-lane-view'
import {
  BAR_STOPS,
  DIAMOND_LIFT,
  DIAMOND_MIN,
  NAME_GAP,
  ONGOING_FROM,
  TICK_HALF,
  alphaAt,
  type Axis,
} from './lane-axis'

// ② 선로: 위 일정 글 줄('D-2 신청 마감', 이름과 같은 x에서 시작, 창 밖이면 오른쪽 끝에 날짜) + 아래 막대 칸.
// 막대는 오늘 점 → 다음 일정(창 밖이면 축 끝)이고, 진하기는 날짜 자리를 따라 오늘 쪽이 진하다.
const CENTER_Y = 'top-1/2 -translate-y-1/2'
const PERCENT = 100

const fadeOf = (color: EventColor) =>
  `linear-gradient(to right, ${BAR_STOPS.map(([at, alpha]) => `${mixColor(color, alpha)} ${at * PERCENT}%`).join(', ')})`

function NextText({ lane }: { lane: HomeEventLane }) {
  const text = milestoneText(lane)
  if (!text) return <span className="text-fg-tertiary">{NO_MILESTONE_TEXT}</span>
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="font-bold text-fg tabular-nums">{text.dday}</span>
      <span className="text-fg-secondary">{text.name}</span>
    </span>
  )
}

type BarProps = { lane: HomeEventLane; axis: Axis; color: EventColor }

function Segment({ lane, axis, color, end }: BarProps & { end: number }) {
  const start = axis.x(0)
  const from = axis.gutter * ONGOING_FROM
  const ongoing = lane.event.status === 'ongoing'
  return (
    <>
      {ongoing && (
        <span
          aria-hidden
          className={cn('absolute h-0.75 rounded-l-full', CENTER_Y)}
          style={{
            left: from,
            width: start - from,
            backgroundImage: `linear-gradient(to right, transparent, ${mixColor(color, alphaAt(axis, start))})`,
          }}
        />
      )}
      <span
        aria-hidden
        className={cn('absolute h-0.75', CENTER_Y, !ongoing && 'rounded-l-full')}
        style={{
          left: start,
          width: Math.max(0, end - start),
          backgroundImage: fadeOf(color),
          backgroundSize: `${axis.width - start}px 100%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </>
  )
}

function Bar({ lane, axis, color }: BarProps) {
  const day = lane.milestone?.days ?? 0
  const out = lane.milestone !== null && day > axis.days - 1
  const end = out ? axis.width : axis.x(day)
  return (
    <div className="relative h-1.5">
      {Array.from({ length: axis.days - 1 }, (_, i) => i + 1).map(tick => (
        <span
          key={tick}
          aria-hidden
          className={cn('absolute h-1.25 w-px bg-border', CENTER_Y)}
          style={{ left: axis.x(tick) - TICK_HALF }}
        />
      ))}
      {lane.milestone && <Segment lane={lane} axis={axis} color={color} end={end} />}
      <span
        aria-hidden
        className={cn('absolute size-1.75 -translate-x-1/2 rounded-full bg-fg', CENTER_Y)}
        style={{ left: axis.x(0) }}
      />
      {lane.milestone && !out && (
        <span
          aria-hidden
          className={cn('absolute size-2.25 -translate-x-1/2 rotate-45 rounded-xs', CENTER_Y)}
          style={{
            left: end,
            backgroundColor: mixColor(
              color,
              Math.max(DIAMOND_MIN, alphaAt(axis, end) + DIAMOND_LIFT),
            ),
          }}
        />
      )}
    </div>
  )
}

export default function EventLane({ lane, axis, color }: BarProps) {
  if (axis.width === 0) return <div className="h-4.5" />
  const text = milestoneText(lane)
  const out = lane.milestone !== null && lane.milestone.days > axis.days - 1
  return (
    <div>
      <div
        className="flex h-4.5 items-center text-row-sub leading-4.5"
        style={{ paddingLeft: axis.x(0) + NAME_GAP }}
      >
        <NextText lane={lane} />
        {out && text && (
          <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-fg-tertiary">
            {text.dateText}
            <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <Bar lane={lane} axis={axis} color={color} />
    </div>
  )
}
