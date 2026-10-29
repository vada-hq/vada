import { useId, useRef } from 'react'
import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { HOME_COUNCIL_EVENT_CARDS, type HomeEventLane, type HomeEventLanes } from '@vada/contracts'
import { Tray, TrayHead } from '@/components/Tray'
import { Button } from '@/components/ui/button'
import EventLaneRow from './EventLaneRow'
import { LANES_EMPTY, LANES_TITLE, type LaneSignal } from './event-lane-view'
import { LaneAxisHead, TodayLine } from './LaneAxisHead'
import { useAxis } from './lane-axis'

type Props = {
  lanes: HomeEventLanes
  // 홈의 오늘(서버가 준 한국 날짜). 축은 이 날을 0일로 그린다.
  today: string
  onOpen: (lane: HomeEventLane) => void
  onSignal: (lane: HomeEventLane, target: LaneSignal['target']) => void
  onSeeAll: () => void
  // 행사를 만들 수 있을 때만(빈 띠의 [새 행사])
  onNewEvent?: (() => void) | undefined
}

// 0건: 회색 띠 한 줄(달력 원 + '진행 중인 행사 없음' | [새 행사])
function Empty({ onNewEvent }: Pick<Props, 'onNewEvent'>) {
  const headId = useId()
  return (
    <div className="@container min-w-0">
      <section
        aria-labelledby={headId}
        className="flex min-h-14 items-center gap-3 rounded-tray bg-muted pr-2 pl-3"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary"
        >
          <CalendarDays className="size-4.5" strokeWidth={2} />
        </span>
        <h2
          id={headId}
          className="min-w-0 flex-1 text-row-sub leading-5 font-medium text-fg-secondary"
        >
          {LANES_EMPTY}
        </h2>
        {onNewEvent && (
          <Button
            variant="link"
            className="h-auto min-h-11 shrink-0 gap-1 rounded-full border-0 px-3 py-0 text-row-sub leading-5 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4.5"
            onClick={onNewEvent}
          >
            <Plus aria-hidden />새 행사
          </Button>
        )}
      </section>
    </div>
  )
}

// ② 행사(e6 확정 시안, 가로 시간 축): 회색 쟁반 위 흰 묶음 / 14일(좁으면 7일) 날짜 머리 / 줄마다 행사 색 네모 | 이름 + 신호 알약 /
// D-n 일정 글 / 오늘 쪽이 진한 행사 색 막대. 창 밖 일정은 '11월 6일 (금) →'.
export default function EventLanesCard({
  lanes,
  today,
  onOpen,
  onSignal,
  onSeeAll,
  onNewEvent,
}: Props) {
  const headId = useId()
  const frame = useRef<HTMLDivElement>(null)
  const axis = useAxis(frame)
  if (lanes.total === 0) return <Empty onNewEvent={onNewEvent} />
  return (
    <Tray labelledBy={headId}>
      <TrayHead id={headId} title={LANES_TITLE} count={lanes.total} />
      <div className="isolate rounded-group bg-card px-3 pt-2 pb-2 @2xl:px-5 @2xl:pt-3 @2xl:pb-3">
        <div ref={frame} className="relative">
          <TodayLine axis={axis} />
          <LaneAxisHead axis={axis} today={today} lanes={lanes.events} />
          <ul>
            {lanes.events.map(lane => (
              <EventLaneRow
                key={lane.event.id}
                lane={lane}
                axis={axis}
                onOpen={() => onOpen(lane)}
                onSignal={target => onSignal(lane, target)}
              />
            ))}
          </ul>
        </div>
      </div>
      {lanes.total > HOME_COUNCIL_EVENT_CARDS && (
        <Button
          variant="ghost"
          className="mt-0.5 min-h-11 w-full gap-0.5 rounded-2xl border-0 px-3 py-2 text-row-sub leading-5 font-medium text-fg-secondary hover:bg-transparent hover:text-fg [&_svg]:size-4.5"
          onClick={onSeeAll}
        >
          {`전체 ${lanes.total}개 보기`}
          <ChevronRight aria-hidden />
        </Button>
      )}
    </Tray>
  )
}
