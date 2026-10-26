import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import type { HomeBoardEvent, HomeCouncilBoard } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import EventStatusChip from '../events/EventStatusChip'
import {
  allEventTotal,
  eventDayLabel,
  nextDeadlineLabel,
  openEventTotal,
  statusCountsLabel,
} from './council-view'
import HomeCard from './HomeCard'
import HomeChip from './HomeChip'
import { HOME_PLANS } from './home-kinds'
import HomeProgress from './HomeProgress'
import { NewEventButton } from './NoOpenEvents'

type Opens = {
  onOpenEvent: (eventId: string) => void
  // 이유 칩: 그 행사 업무 탭. 담당자 없음은 그 보기로 거른다(지남 거르기는 업무 칩 줄이 생기면 더한다, 명세 027 조각 11).
  onOpenTasks: (eventId: string, unassigned: boolean) => void
}

// 이유 칩은 카드 전체를 덮는 행사 단추 위에 올려 따로 누른다.
function ReasonChip({
  label,
  count,
  onOpen,
}: {
  label: '지남' | '담당자 없음'
  count: number
  onOpen: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      // 휴대폰에서 누르는 영역을 44px로 키우되 줄 높이는 그대로 둔다(WCAG 2.5.8, 머리 링크와 같은 방식).
      className="relative h-auto p-0 hover:bg-transparent max-sm:-my-2.5 max-sm:min-h-11"
      onClick={onOpen}
    >
      <HomeChip label={label} count={count} />
    </Button>
  )
}

// 행사 칸 카드(와이어프레임 HomePrototypeEventCard): 상태 칩 · 행사명 · 날짜 / 업무 막대 / 이유 칩 / 다음 마감.
// 책임 부서·책임자와 준비율(%)은 두지 않는다(DEC-95). 같은 줄 카드의 다음 마감 선을 맞추려고 마지막 줄을 아래에 붙인다.
function EventTile({
  card,
  today,
  onOpenEvent,
  onOpenTasks,
}: Opens & { card: HomeBoardEvent; today: string }) {
  const { event, tasks } = card
  const clear = tasks.overdue === 0 && tasks.unassigned === 0
  return (
    <li className="relative flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50">
      {/* 칸이 좁으면(1024px 창의 3열) 행사명 자리를 지키고 날짜를 다음 줄로 내린다. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EventStatusChip status={event.status} />
        <Button
          variant="link"
          className="h-auto min-w-24 flex-1 justify-start p-0 text-left text-sm font-bold text-gray-900 after:absolute after:inset-0"
          onClick={() => onOpenEvent(event.id)}
        >
          <span className="truncate">{event.name}</span>
        </Button>
        <span className="shrink-0 text-xs text-gray-500">{eventDayLabel(event, today)}</span>
      </div>
      <HomeProgress label="업무" done={tasks.done} total={tasks.total} />
      <div className="flex min-h-6 flex-wrap items-center gap-1.5 max-sm:gap-3">
        {clear && <span className="text-xs text-gray-500">확인 필요 없음</span>}
        {tasks.overdue > 0 && (
          <ReasonChip
            label="지남"
            count={tasks.overdue}
            onOpen={() => onOpenTasks(event.id, false)}
          />
        )}
        {tasks.unassigned > 0 && (
          <ReasonChip
            label="담당자 없음"
            count={tasks.unassigned}
            onOpen={() => onOpenTasks(event.id, true)}
          />
        )}
      </div>
      <p className="mt-auto truncate border-t border-gray-100 pt-2 text-xs text-gray-700">
        {nextDeadlineLabel(card.next)}
      </p>
    </li>
  )
}

type Props = Opens & {
  events: HomeCouncilBoard['events']
  today: string
  onSeeAll: () => void
  // 행사를 만들 수 있는 사람에게만 온다(canCreateEvent, 명세 027 정한 것 11).
  onNewEvent?: (() => void) | undefined
}

// 회장단 '전체 행사 진행 현황'(가로 전체): 머리에 상태별 수, 카드 셋, 넘치면 '전체 {n}개 보기' → 행사 목록.
export default function CouncilEventsCard({
  events,
  today,
  onSeeAll,
  onNewEvent,
  ...opens
}: Props) {
  const rows: ReactNode[] = events.cards.map(card => (
    <EventTile key={card.event.id} card={card} today={today} {...opens} />
  ))
  return (
    <HomeCard
      title={HOME_PLANS.council.top}
      icon={Star}
      unit="개"
      tiles
      read={{ kind: 'ready', total: openEventTotal(events.counts), rows }}
      aside={statusCountsLabel(events.counts)}
      seeAllTotal={allEventTotal(events.counts)}
      onSeeAll={onSeeAll}
      empty="진행할 행사 없음"
      emptyAction={onNewEvent && <NewEventButton onNewEvent={onNewEvent} />}
    />
  )
}
