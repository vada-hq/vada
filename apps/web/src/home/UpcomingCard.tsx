import { Calendar } from 'lucide-react'
import type { HomeUpcoming, HomeUpcomingItem } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { openMenu, openRecord } from '@/lib/go-to'
import { upcomingParts } from './council-view'
import HomeCard from './HomeCard'
import { ScheduleTag } from './HomeChip'
import HomeRow from './HomeRow'

type UpcomingOpeners = {
  onOpenTask: (taskId: string) => void
  // 행사 시작은 행사, 참가 신청 마감은 그 행사 '인원 관리' 탭이다(명세 027 정한 것 12).
  onOpenEvent: (eventId: string, tab?: 'registrations') => void
}

const keyOf = (item: HomeUpcomingItem) =>
  `${item.kind}-${item.kind === 'task_due' ? item.task.id : item.kind === 'registration_close' ? item.form.id : item.kind === 'schedule_item' ? item.item.id : item.event.id}`

function open(item: HomeUpcomingItem, opens: UpcomingOpeners, councilId: string) {
  if (item.kind === 'schedule_item') return openRecord('schedule', councilId, item.item.id)
  if (item.kind === 'task_due') return opens.onOpenTask(item.task.id)
  if (item.kind === 'registration_close') return opens.onOpenEvent(item.event.id, 'registrations')
  return opens.onOpenEvent(item.event.id)
}

// 가까운 일정 카드(와이어프레임 HOME-01C '가까운 주요 일정', 01D·01M '가까운 일정'): 왼쪽 날짜, 제목과 메타, 오른쪽 종류 칩.
// 서버가 정한 차례(날짜순, 같은 날 종일 먼저) 그대로 각 줄의 원본을 연다(DEC-95·102).
export default function UpcomingCard({
  councilId,
  title,
  upcoming,
  headClassName,
  wideDate = false,
  ...opens
}: UpcomingOpeners & {
  councilId: string
  title: string
  upcoming: HomeUpcoming
  headClassName?: string
  // 2×2 카드(부원·부서장)는 1024px 창에서도 카드가 넓어 날짜를 한 줄로 둔다. 없으면 회장단 3열처럼 좁을 때 접는다.
  wideDate?: boolean
}) {
  const rows = upcoming.items.map(item => {
    const parts = upcomingParts(item)
    return (
      <HomeRow
        key={keyOf(item)}
        card
        lead={
          // 3열이 좁은 폭(1024px 창)에서는 날짜를 두 줄('10월 27일' / '(화)')로 접어 제목 자리를 남긴다.
          <span
            className={cn(
              'w-24 shrink-0 text-xs font-semibold break-keep text-gray-500',
              !wideDate && '@2xl:w-14 @4xl:w-24',
            )}
          >
            {parts.date}
          </span>
        }
        title={parts.title}
        meta={parts.meta}
        side={<ScheduleTag label={parts.chip} />}
        onOpen={() => open(item, opens, councilId)}
      />
    )
  })
  return (
    <HomeCard
      title={title}
      icon={Calendar}
      read={{ kind: 'ready', total: upcoming.total, rows }}
      empty="7일 안 일정 없음"
      onSeeAll={() => openMenu('calendar', councilId)}
      headClassName={headClassName}
    />
  )
}
