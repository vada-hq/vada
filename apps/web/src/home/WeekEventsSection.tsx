import { CalendarDays } from 'lucide-react'
import { EVENT_STATUS_LABEL, type EventSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { EVENT_STATUS_TONE, spanLabel } from '../events/event-view'
import { dDay, SHORT_LIST } from './home-view'
import { DateBox } from './HomeEventRow'
import HomeRow from './HomeRow'
import HomeSection from './HomeSection'

type Props = {
  events: EventSummary[]
  today: string
  onOpenEvent: (eventId: string) => void
  // 행사 화면으로 간다.
  onSeeAll: () => void
}

// 이번 주 행사: 진행 중이거나 7일 안에 시작하는 행사(요구 11). 없으면 부분을 두지 않는다.
export default function WeekEventsSection({ events, today, ...open }: Props) {
  if (events.length === 0) return null
  return (
    <HomeSection id="home-week" icon={CalendarDays} title="이번 주 행사" onSeeAll={open.onSeeAll}>
      {events.slice(0, SHORT_LIST).map(event => (
        <HomeRow
          key={event.id}
          title={event.name}
          lead={<DateBox startsAt={event.startsAt} past={false} />}
          meta={[spanLabel(event), event.place]}
          side={
            event.status === 'ongoing' ? (
              <Badge tone={EVENT_STATUS_TONE.ongoing}>{EVENT_STATUS_LABEL.ongoing}</Badge>
            ) : (
              event.startsAt && (
                <span className="font-medium text-gray-700">{dDay(today, event.startsAt)}</span>
              )
            )
          }
          onOpen={() => open.onOpenEvent(event.id)}
        />
      ))}
    </HomeSection>
  )
}
