import type { HomeEventLane } from '@vada/contracts'
import SignalPill from '@/components/SignalPill'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { eventColorOf } from '@/lib/event-color'
import { cn } from '@/lib/utils'
import EventLane from './EventLane'
import { signalsOf, type LaneSignal } from './event-lane-view'
import { EVENT_MARK_GAP, EVENT_MARK_SIZE, NAME_GAP, type Axis } from './lane-axis'

type Props = {
  lane: HomeEventLane
  axis: Axis
  onOpen: () => void
  onSignal: (target: LaneSignal['target']) => void
}

// ② 행사 줄: 행사 네모(오늘 선 왼쪽, 가득 찬 행사 색, 글자 없음) | 이름 + 신호 알약 / 그 아래 일정 글 + 막대.
// 줄 전체가 행사 보기(이름 단추의 덮개)이고, 알약은 덮개 위에서 따로 누른다. 사람(① 얼굴, 둥근 원)과 행사(네모·막대)는 모양으로 가른다.
export default function EventLaneRow({ lane, axis, onOpen, onSignal }: Props) {
  const color = eventColorOf(lane.event.color)
  const signals = signalsOf(lane)
  return (
    <li className="group/row relative py-2 before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-2 before:-z-10 before:rounded-2xl hover:before:bg-surface-subtle @2xl:py-1.25">
      <div
        className="flex min-h-6 flex-wrap items-center gap-x-2.5 gap-y-2.5 @2xl:min-h-7 @2xl:gap-y-1.5"
        style={{ paddingLeft: axis.gutter + NAME_GAP }}
      >
        <span
          aria-hidden
          className={cn('absolute top-3.75 size-2.5 rounded-xs @2xl:top-3.5', color.solid)}
          style={{ left: axis.gutter - EVENT_MARK_GAP - EVENT_MARK_SIZE }}
        />
        <Button
          variant="link"
          className={cn(
            'h-auto max-w-full min-w-0 justify-start border-0 p-0 text-left text-row-title font-semibold tracking-tight whitespace-normal text-fg group-hover/row:underline hover:underline',
            rowLinkTarget,
          )}
          onClick={onOpen}
        >
          <span className="line-clamp-2 break-keep wrap-anywhere @2xl:line-clamp-none @2xl:truncate">
            {lane.event.name}
          </span>
        </Button>
        {signals.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-4 @2xl:gap-y-1.5">
            {signals.map(signal => (
              <SignalPill
                key={signal.key}
                icon={signal.icon}
                tone={signal.tone}
                label={signal.label}
                onClick={() => onSignal(signal.target)}
              >
                {signal.text}
              </SignalPill>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 @2xl:mt-0">
        <EventLane lane={lane} axis={axis} color={color} />
      </div>
    </li>
  )
}
