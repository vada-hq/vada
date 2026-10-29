import type { ReactNode } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import type { HomeParticipating, HomeParticipation } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import EventStatusChip from '../events/EventStatusChip'
import HomeCard from './HomeCard'
import HomeProgress from './HomeProgress'
import { participationDay, participationNext } from './member-view'

// 참여 행사 한 줄(와이어프레임 HomePrototypeEventRow): 상태 칩 · 행사명 · 날짜 · > / '부서 업무 n/m' 막대 / 다음 마감.
// 줄 어디를 눌러도 행사가 열린다. 긴 행사명은 어절로 접어 두 줄까지 보이고 줄임표다(주요 행사 타일과 같음, 전체 이름은 행사 화면).
function ParticipationRow({ row, onOpen }: { row: HomeParticipation; onOpen: () => void }) {
  return (
    <li className="relative flex flex-col gap-1.5 px-5 py-2.5 transition-colors hover:bg-surface-subtle">
      <div className="flex items-center gap-2">
        <span className="shrink-0">
          <EventStatusChip status={row.event.status} />
        </span>
        <Button
          variant="link"
          className="line-clamp-2 h-auto min-w-0 flex-1 shrink justify-start p-0 text-left text-sm font-bold break-keep whitespace-normal text-fg wrap-anywhere after:absolute after:inset-0"
          onClick={onOpen}
        >
          {row.event.name}
        </Button>
        <span className="shrink-0 text-xs text-fg-muted">{participationDay(row)}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      </div>
      <HomeProgress label="부서 업무" done={row.tasks.done} total={row.tasks.total} />
      <p className="truncate text-xs text-fg-secondary">{participationNext(row)}</p>
    </li>
  )
}

type Props = {
  // 부원 '참여 행사 진행', 부서장 '우리 부서 참여 행사'(DEC-95)
  title: string
  participating: HomeParticipating
  onOpenEvent: (eventId: string) => void
  onSeeAll: () => void
  // 비었을 때 빈 문구 아래(만들 수 있는 사람의 [새 행사], 없는 사람에게 누가 만드는지)
  emptyAction: ReactNode
}

// 그 사람의 부서가 담당 부서인 완료 전 행사(DEC-95). 서버 차례(진행 중 → 기획 중, 날짜 미정은 끝) 그대로 앞 3줄이다.
export default function ParticipatingCard({
  title,
  participating,
  onOpenEvent,
  onSeeAll,
  emptyAction,
}: Props) {
  const rows = participating.events.map(row => (
    <ParticipationRow key={row.event.id} row={row} onOpen={() => onOpenEvent(row.event.id)} />
  ))
  return (
    <HomeCard
      title={title}
      icon={Star}
      unit="개"
      read={{ kind: 'ready', total: participating.total, rows }}
      empty="참여 행사 없음"
      emptyAction={emptyAction}
      onSeeAll={onSeeAll}
    />
  )
}
