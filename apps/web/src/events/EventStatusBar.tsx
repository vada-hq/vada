import type { ReactNode } from 'react'
import { CalendarDays, MapPin, type LucideIcon } from 'lucide-react'
import { EVENT_STATUS_LABEL, type EventDetail } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { endedLabel, healthOf, nextLabel, ownerLine } from './event-header-view'
import { EVENT_STATUS_TONE, whenLabel } from './event-view'

// 칸 하나(행사일, 장소). 비었으면 '미정'으로 보인다(와이어프레임: 미정 정보는 빈칸이 아닌 미정).
function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Icon aria-hidden className="size-3.5 shrink-0 text-gray-400" />
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </span>
  )
}

// 행사 공통 머리의 요약 줄(와이어프레임 EVT-02 EventWorkspaceHeader): 탭 아래에 상태 칩과 건강도, 담당·행사일·다음 일정, 오른쪽에 행동 버튼.
// 장소는 와이어프레임에서 개요의 기본 정보 카드에 있는데, 그 카드가 오기 전이라 행사일 옆에 둔다.
// 좁은 화면에서는 줄을 바꿔 넘치지 않는다.
export function EventStatusBar({ event, actions }: { event: EventDetail; actions: ReactNode }) {
  const health = healthOf(event.health)
  const ended = endedLabel(event.endedDays)
  return (
    <div
      role="group"
      aria-label="행사 요약"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
        <Badge tone={health.tone} className="whitespace-normal">
          {health.text}
        </Badge>
        {ended && <span className="text-xs font-medium text-red-700">{ended}</span>}
      </div>
      <span aria-hidden className="hidden h-4 border-l sm:block" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="min-w-0 wrap-anywhere">{ownerLine(event)}</span>
        <Meta icon={CalendarDays}>{whenLabel(event)}</Meta>
        <Meta icon={MapPin}>{event.place ?? '장소 미정'}</Meta>
        <span className="min-w-0 wrap-anywhere">{nextLabel(event.next)}</span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
