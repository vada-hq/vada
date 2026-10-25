import type { HomeEventCard } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  dateBlock,
  EVENT_STATUS_LABEL,
  EVENT_STATUS_TONE,
  settlementLabel,
  spanLabel,
} from '../events/event-view'
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
        block ? 'bg-blue-50 text-blue-700' : 'border border-dashed text-gray-400',
        past && 'bg-gray-100 text-gray-500',
      )}
    >
      <span className="text-xs font-medium">{block?.month ?? '날짜'}</span>
      <span className="text-lg leading-6 font-bold">{block?.day ?? '미정'}</span>
    </div>
  )
}

// 오른쪽 끝: 진행 중·끝남은 상태, 예정은 남은 날. 날짜 미정은 제목 아래 날짜 자리가 말한다.
function Side({ card, today }: Pick<Props, 'card' | 'today'>) {
  const { event } = card
  if (event.status === 'upcoming' && event.startsAt)
    return <span className="font-medium text-gray-700">{dDay(today, event.startsAt)}</span>
  if (event.status === 'ongoing' || event.status === 'ended')
    return <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
  return null
}

// 학생회의 행사 한 줄: 이름, 날짜 · 업무 진행 · 막힌 수(있을 때만) · 정산에 남은 것. 카드 대신 줄로 두어 견주기 쉽게 한다(NN/g Cards).
export default function HomeEventRow({ card, today, onOpen }: Props) {
  const { event, tasks, settlement } = card
  return (
    <HomeRow
      title={event.name}
      meta={[
        spanLabel(event),
        tasks.total > 0 && `업무 ${tasks.done}/${tasks.total}`,
        ...riskParts(tasks),
        settlement && (
          <span key="settlement" className="font-medium text-gray-700">
            {settlementLabel(settlement)}
          </span>
        ),
      ]}
      lead={<DateBox startsAt={event.startsAt} past={event.status === 'ended'} />}
      side={<Side card={card} today={today} />}
      onOpen={() => (settlement ? onOpen(event.id, 'money') : onOpen(event.id))}
    />
  )
}
