import type { EventSummary, HomeEventCard } from '@vada/contracts'
import { settlementLabel, whenLabel } from '../events/event-view'
import EventStatusChip from '../events/EventStatusChip'
import { dDay } from './home-view'
import HomeRow from './HomeRow'
import { riskParts } from './risk-parts'

type Props = {
  card: HomeEventCard
  today: string
  onOpen: (eventId: string, tab?: 'money') => void
}

// 일시와 시작까지 남은 날: '10월 26일 (월) 18:00', 'D-3'(DEC-95 '{날짜} · D-N', 날짜 꼴은 AGENTS 날짜 규칙). 남은 날은 예정 행사만이다.
// 날짜가 글로 있어 왼쪽 날짜 칸을 두지 않는다(와이어프레임 행사 줄에 없고, 화면 읽기에도 날짜가 읽힌다).
export function whenParts(event: EventSummary, today: string) {
  return [
    whenLabel(event),
    event.status === 'upcoming' && event.startsAt && (
      <span key="d-day" className="font-medium text-fg-secondary">
        {dDay(today, event.startsAt)}
      </span>
    ),
  ]
}

// 학생회의 행사 한 줄: 상태 칩, 이름, 날짜 · 남은 날 · 업무 진행 · 막힌 수(있을 때만) · 정산에 남은 것. 카드 대신 줄로 두어 견주기 쉽게 한다(NN/g Cards).
export default function HomeEventRow({ card, today, onOpen }: Props) {
  const { event, tasks, settlement } = card
  return (
    <HomeRow
      title={event.name}
      meta={[
        ...whenParts(event, today),
        tasks.total > 0 && `업무 ${tasks.done}/${tasks.total}`,
        ...riskParts(tasks),
        settlement && (
          <span key="settlement" className="font-medium text-fg-secondary">
            {settlementLabel(settlement)}
          </span>
        ),
      ]}
      chip={<EventStatusChip status={event.status} />}
      onOpen={() => (settlement ? onOpen(event.id, 'money') : onOpen(event.id))}
    />
  )
}
