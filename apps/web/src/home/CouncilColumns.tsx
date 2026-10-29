import { Check, ChevronRight } from 'lucide-react'
import type { HomeCouncilBoard } from '@vada/contracts'
import EventStatusChip from '../events/EventStatusChip'
import { followUpParts, remainingTidyLabel } from './council-view'
import HomeCard from './HomeCard'
import { HOME_PLANS } from './home-kinds'
import HomeRow from './HomeRow'

const FOLLOW_UP = HOME_PLANS.council.columns[1]

// 회장단 '후속 정리 중인 행사'(3열 가운데): 끝났고 완료하지 않은 행사, 끝난 지 오래된 것부터(재정 '행사 정산' 탭과 같은 차례).
// 정산이 남은 행사는 행사 '재정' 탭으로 연다(DEC-95). 전체 보기는 같은 셈·차례의 재정 '행사 정산' 탭이다(정한 것 6).
export function FollowUpCard({
  followUp,
  onOpenEvent,
  onSeeAll,
}: {
  followUp: HomeCouncilBoard['followUp']
  onOpenEvent: (eventId: string, tab?: 'money') => void
  onSeeAll: () => void
}) {
  const rows = followUp.events.map(row => (
    <HomeRow
      key={row.event.id}
      card
      chip={<EventStatusChip status={row.event.status} />}
      title={row.event.name}
      meta={followUpParts(row)}
      sub={remainingTidyLabel(row.remaining)}
      side={<ChevronRight aria-hidden className="size-4 text-fg-subtle" />}
      onOpen={() =>
        row.remaining.settlement > 0
          ? onOpenEvent(row.event.id, 'money')
          : onOpenEvent(row.event.id)
      }
    />
  ))
  return (
    <HomeCard
      title={FOLLOW_UP}
      icon={Check}
      unit="개"
      read={{ kind: 'ready', total: followUp.total, rows }}
      empty="후속 정리 중인 행사 없음"
      onSeeAll={onSeeAll}
    />
  )
}
