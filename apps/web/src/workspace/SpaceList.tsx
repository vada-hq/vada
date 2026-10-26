import { useId } from 'react'
import { Plus, Settings } from 'lucide-react'
import { EVENT_STATUS_LABEL, type SidebarEvent } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { NavItem } from '@/components/ui/nav-item'
import { eventInitial, type ActiveItem } from './space-view'

export type SpaceProps = {
  // 완료하지 않은 행사(서버 차례). 아직 못 읽었거나 학생회를 잃었으면 null이라 줄이 없다.
  events: SidebarEvent[] | null
  onOpenCouncil: () => void
  onOpenEvent: (eventId: string) => void
  onSeeAll: () => void
  // 행사를 만들 수 있는 사람만(canCreateEvent). 없으면 [+ 새 행사]가 없다.
  onNewEvent: (() => void) | undefined
  // 새 행사 창이 권한을 잃어 닫혔을 때 그 이유
  lost: string | null
}

// 행사 줄(와이어프레임 사이드바 v6.2, DEC-96): 회색 네모 안 첫 글자, 한 줄 말줄임 이름(올리면 전체 이름), 작은 회색 상태 글. 배지는 없다(DEC-85).
function EventLine({
  event,
  active,
  onOpen,
}: {
  event: SidebarEvent
  active: boolean
  onOpen: () => void
}) {
  return (
    <NavItem active={active} className="gap-2" onClick={onOpen}>
      {/* 첫 글자는 gray-100 네모 위라 gray-500으로는 4.5:1에 못 미쳐 gray-600이다(WCAG 1.4.3). */}
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600"
      >
        {eventInitial(event.name)}
      </span>
      <span className="min-w-0 flex-1 truncate" title={event.name}>
        {event.name}
      </span>
      {/* 켜진 줄의 파란 바탕(blue-50)에서 gray-500은 4.5:1에 조금 모자라 한 단계 진하게 한다(WCAG 1.4.3). */}
      <span className={`shrink-0 text-xs ${active ? 'text-gray-600' : 'text-gray-500'}`}>
        {EVENT_STATUS_LABEL[event.status]}
      </span>
    </NavItem>
  )
}

// 옆 메뉴 '공간' 묶음: 우리 학생회, 완료하지 않은 행사 줄, [행사 모두 보기], (권한이 있으면) [+ 새 행사]. 빈 행사 안내는 없다.
// 넓은 화면의 옆 메뉴와 휴대폰 서랍이 같이 쓴다.
export default function SpaceList({
  events,
  active,
  onOpenCouncil,
  onOpenEvent,
  onSeeAll,
  onNewEvent,
  lost,
}: SpaceProps & { active: ActiveItem }) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="px-3 pt-4 pb-1.5 text-xs font-semibold text-gray-500">
        공간
      </p>
      <NavItem
        active={active?.kind === 'menu' && active.menu === 'council'}
        className="min-h-11 break-keep md:min-h-0"
        onClick={onOpenCouncil}
      >
        <Settings aria-hidden className="size-4 shrink-0" />
        우리 학생회
      </NavItem>
      {events?.map(event => (
        <EventLine
          key={event.id}
          event={event}
          active={active?.kind === 'event' && active.id === event.id}
          onOpen={() => onOpenEvent(event.id)}
        />
      ))}
      <NavItem
        active={active?.kind === 'allEvents'}
        className="mb-0 py-1.5 text-xs text-gray-500 hover:bg-transparent hover:text-blue-700"
        onClick={onSeeAll}
      >
        행사 모두 보기
      </NavItem>
      {onNewEvent && (
        <Button
          variant="link"
          size="sm"
          className="w-full justify-start gap-1"
          onClick={onNewEvent}
        >
          <Plus aria-hidden />새 행사
        </Button>
      )}
      {lost && (
        <StateMessage kind="error" className="px-3 text-xs">
          {lost}
        </StateMessage>
      )}
    </div>
  )
}
