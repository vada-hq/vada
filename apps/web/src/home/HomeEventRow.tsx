import type { EventSummary, HomeEventCard } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { dateBlock, settlementLabel, spanLabel } from '../events/event-view'
import EventStatusChip from '../events/EventStatusChip'
import { dDay } from './home-view'
import HomeRow from './HomeRow'
import { riskParts } from './risk-parts'

type Props = {
  card: HomeEventCard
  today: string
  onOpen: (eventId: string, tab?: 'money') => void
}

// 왼쪽 날짜 칸: 행사 목록과 같은 모양이라 행사인 줄 바로 알아본다. 끝난 행사는 옅게 둔다.
export function DateBox({ startsAt, past }: { startsAt: string | null; past: boolean }) {
  const block = dateBlock(startsAt)
  return (
    <div
      aria-hidden
      className={cn(
        'flex w-12 shrink-0 flex-col items-center rounded-md py-1',
        block ? 'bg-blue-50 text-blue-700' : 'border border-dashed text-gray-500',
        past && 'bg-gray-100 text-gray-500',
      )}
    >
      <span className="text-xs font-medium">{block?.month ?? '날짜'}</span>
      <span className="text-lg leading-6 font-bold">{block?.day ?? '미정'}</span>
    </div>
  )
}

// 일시와 시작까지 남은 날: '월요일 18:00', 'D-3'. 남은 날은 예정 행사만이고 날짜 쪽에 둔다(와이어프레임 '{날짜} · D-N').
// 오른쪽 끝은 행사 화면과 같은 상태 칩이라(DEC-93) 남은 날이 상태 자리를 차지하지 않는다.
export function whenParts(event: EventSummary, today: string) {
  return [
    spanLabel(event),
    event.status === 'upcoming' && event.startsAt && (
      <span key="d-day" className="font-medium text-gray-700">
        {dDay(today, event.startsAt)}
      </span>
    ),
  ]
}

// 학생회의 행사 한 줄: 이름, 날짜 · 남은 날 · 업무 진행 · 막힌 수(있을 때만) · 정산에 남은 것. 카드 대신 줄로 두어 견주기 쉽게 한다(NN/g Cards).
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
          <span key="settlement" className="font-medium text-gray-700">
            {settlementLabel(settlement)}
          </span>
        ),
      ]}
      lead={<DateBox startsAt={event.startsAt} past={event.status === 'ended'} />}
      side={<EventStatusChip status={event.status} />}
      onOpen={() => (settlement ? onOpen(event.id, 'money') : onOpen(event.id))}
    />
  )
}
