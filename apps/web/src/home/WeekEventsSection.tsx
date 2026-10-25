import { CalendarDays } from 'lucide-react'
import { EVENT_STATUS_LABEL, type EventSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { EVENT_STATUS_TONE, spanLabel } from '../events/event-view'
import { dDay, SHORT_LIST } from './home-view'
import { DateBox } from './HomeEventRow'
import HomeRow from './HomeRow'
import HomeSection from './HomeSection'
import NoOpenEvents from './NoOpenEvents'

type Props = {
  events: EventSummary[]
  today: string
  onOpenEvent: (eventId: string) => void
  // 학생회에 완료하지 않은 행사가 하나도 없음을 읽어 알았다(읽기 전이나 실패면 false).
  noOpenEvents: boolean
  // 행사 화면으로 간다.
  onSeeAll: () => void
  // 행사를 만들 수 있는 사람에게만 온다.
  onNewEvent?: (() => void) | undefined
}

// 이번 주 행사: 진행 중이거나 7일 안에 시작하는 행사(요구 11). 없으면 부분을 두지 않는다.
// 다만 진행할 행사가 하나도 없으면 만들 수 있는 사람(부서장)에게 그 자리에 [새 행사]를 둔다(DEC-95, DEC-93).
export default function WeekEventsSection({ events, today, noOpenEvents, ...open }: Props) {
  if (events.length === 0 && !(noOpenEvents && open.onNewEvent)) return null
  return (
    <HomeSection id="home-week" icon={CalendarDays} title="이번 주 행사" onSeeAll={open.onSeeAll}>
      {events.length === 0 && <NoOpenEvents onNewEvent={open.onNewEvent} />}
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
