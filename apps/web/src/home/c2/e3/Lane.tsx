import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { C2Event, C2Next } from '../c2-data'
import type { Axis } from './axis'
import {
  DIAMOND,
  LABEL_GAP,
  LABEL_PAD,
  LANE,
  SEGMENT,
  TEXT_SUB,
  TICK,
  TICK_HALF,
  TODAY_NODE,
  type EventTint,
} from './tokens'

const CENTER_Y = 'top-1/2 -translate-y-1/2'
// 일정 글 바탕: 눈금·선분을 가리는 흰 면. 줄 hover 면과 같이 바뀐다.
const LABEL_FACE = 'bg-card group-hover/row:bg-surface-subtle'
// 진행 중인 행사의 선분은 오늘 선 앞(머리글자 칸)부터 옅게 시작한다(e07의 축 밖으로 이어진 막대).
const ONGOING_FROM = 0.35

// 하루 눈금: 선로가 비어도 '날이 이어진다'가 보이게 하는 자
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

// 다음 일정 글 'D-2 신청 마감'. D-n은 굵게(1순위), 일정 이름은 보통.
function NextText({ event }: { event: C2Event }) {
  if (!event.next) return <span className="text-fg-tertiary">{event.nextText}</span>
  return (
    <>
      <span className="font-bold text-fg tabular-nums">{event.next.dday}</span>
      <span className="text-fg-secondary">{event.next.name}</span>
    </>
  )
}

// 일정 글이 축 오른쪽 끝을 넘으면 표식 왼쪽으로 뒤집는다(그린 뒤 글 폭을 재서 정함).
function useFlip(axis: Axis, day: number, text: string) {
  const ref = useRef<HTMLSpanElement>(null)
  const [flip, setFlip] = useState(false)
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0
    setFlip(axis.x(day) + LABEL_GAP + w > axis.width)
  }, [axis, day, text])
  return { ref, flip }
}

type Place = { day: number; out: boolean; flip: boolean }

function labelStyle(axis: Axis, next: C2Next | null, { day, out, flip }: Place) {
  if (!next) return { left: axis.x(0) + LABEL_GAP - LABEL_PAD }
  if (out) return { right: 0 }
  if (flip) return { right: axis.width - axis.x(day) + LABEL_GAP - LABEL_PAD }
  return { left: axis.x(day) + LABEL_GAP - LABEL_PAD }
}

// 선분: 오늘 점 → 다음 일정(축 밖이면 오른쪽 끝). 진행 중이면 오늘 선 앞에서 옅게 시작한다.
function Segment({
  event,
  axis,
  tint,
  end,
}: {
  event: C2Event
  axis: Axis
  tint: EventTint
  end: number
}) {
  const start = axis.x(0)
  const from = axis.gutter * ONGOING_FROM
  return (
    <>
      {event.ongoing && (
        <span
          aria-hidden
          className={cn('absolute rounded-l-full bg-linear-to-r', CENTER_Y, SEGMENT, tint.fade)}
          style={{ left: from, width: start - from }}
        />
      )}
      <span
        aria-hidden
        className={cn(
          'absolute',
          CENTER_Y,
          SEGMENT,
          tint.segment,
          !event.ongoing && 'rounded-l-full',
        )}
        style={{ left: start, width: end - start }}
      />
    </>
  )
}

function Diamond({ x, tint }: { x: number; tint: EventTint }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -translate-x-1/2 rotate-45 rounded-[2px] ring-2 ring-card',
        CENTER_Y,
        DIAMOND,
        tint.mark,
      )}
      style={{ left: x }}
    />
  )
}

// 선로: 하루 눈금 / 오늘 점 → 다음 일정 마름모 선분 / 일정 글. 14일(358은 7일)을 넘는 일정은 선분이 끝까지 가고 글 끝에 꺾쇠.
export function Lane({ event, axis, tint }: { event: C2Event; axis: Axis; tint: EventTint }) {
  const day = event.next?.days ?? 0
  const out = event.next !== null && day > axis.days - 1
  const { ref, flip } = useFlip(axis, day, event.nextText)
  if (axis.width === 0) return <div className={LANE} />
  return (
    <div className={cn('relative', LANE)}>
      <Ticks axis={axis} />
      {event.next && (
        <Segment event={event} axis={axis} tint={tint} end={out ? axis.width : axis.x(day)} />
      )}
      <span
        aria-hidden
        className={cn('absolute -translate-x-1/2 rounded-full bg-fg', CENTER_Y, TODAY_NODE)}
        style={{ left: axis.x(0) }}
      />
      {event.next && !out && <Diamond x={axis.x(day)} tint={tint} />}
      <span
        ref={ref}
        className={cn(
          'absolute top-0 flex h-5 items-center gap-1 px-1 whitespace-nowrap',
          TEXT_SUB,
          LABEL_FACE,
        )}
        style={labelStyle(axis, event.next, { day, out, flip })}
      >
        <NextText event={event} />
        {out && <ChevronRight aria-hidden className="-mr-1 size-4 text-fg-tertiary" />}
      </span>
    </div>
  )
}
