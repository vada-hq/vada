import type { ReactNode } from 'react'
import { ChevronRight, ClipboardList, MessageSquare, Receipt, type LucideIcon } from 'lucide-react'
import type { HomeMyRequests, HomeMyTasks } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RoomListState } from '../chat/useRoomList'
import { STATUS_LABEL, STATUS_TONE } from '../finance/purchase-view'
import HomeCard from './HomeCard'
import HomeChip from './HomeChip'
import { HOME_PLANS } from './home-kinds'
import HomeRow from './HomeRow'
import { myTasksRow, requestParts, unreadRoomsLabel } from './member-view'

const [, , REQUESTS, WORK] = HOME_PLANS.member.cards

const chevron = <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-400" />

// 내 요청(와이어프레임 '확정된 결정·안내' 자리, DEC-95): 반려·일부 승인(14일 안) → 결재 대기 오래된 순, 서버 차례 그대로.
// 줄은 그 요청, 전체 보기는 재정 구매 요청 탭(내 요청)이다. 줄 꼴은 HOME-01D 구매 줄(제목, 메타, 상태 칩, >).
export function MyRequestsCard({
  myRequests,
  onOpenRequest,
  onSeeAll,
}: {
  myRequests: HomeMyRequests
  onOpenRequest: (requestId: string) => void
  onSeeAll: () => void
}) {
  const rows = myRequests.requests.map(request => (
    <HomeRow
      key={request.id}
      card
      title={request.title}
      meta={requestParts(request)}
      side={
        <>
          <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          {chevron}
        </>
      }
      onOpen={() => onOpenRequest(request.id)}
    />
  ))
  return (
    <HomeCard
      title={REQUESTS}
      icon={Receipt}
      read={{ kind: 'ready', total: myRequests.total, rows }}
      empty="내 요청 없음"
      onSeeAll={onSeeAll}
    />
  )
}

// 와이어프레임 '내 업무·메시지' 줄 머리의 색 아이콘 칸(파란 클립보드, 보라 말풍선).
function IconBox({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-7 shrink-0 items-center justify-center rounded', className)}
    >
      <Icon className="size-4" />
    </span>
  )
}

// 줄 끝 바로가기 글: 파란 '내 업무 >', '메시지 >'(와이어프레임 HOME-01M).
const goTo = (label: string, before?: ReactNode) => (
  <>
    {before}
    <span className="text-blue-600">{label}</span>
    {chevron}
  </>
)

// 내 업무·메시지(DEC-95): 첫 줄 '내 업무 {n}'과 가장 가까운 마감(지났으면 '지남'), 둘째 줄 안 읽은 방 수. 머리는 '바로가기'.
// 지남·오늘 줄 목록은 업무 '내 업무' 탭이 맡는다(같은 것을 두 번 싣지 않음).
export function MyWorkCard({
  myTasks,
  rooms,
  onOpenTasks,
  onOpenChat,
}: {
  myTasks: HomeMyTasks
  // 메시지함과 같은 대화 목록(DEC-90)
  rooms: RoomListState
  onOpenTasks: () => void
  onOpenChat: () => void
}) {
  const work = myTasksRow(myTasks)
  const rows = [
    <HomeRow
      key="tasks"
      card
      lead={<IconBox icon={ClipboardList} className="bg-blue-50 text-blue-600" />}
      title={work.title}
      meta={work.meta}
      side={goTo('내 업무', work.overdue && <HomeChip label="지남" />)}
      onOpen={onOpenTasks}
    />,
    <HomeRow
      key="messages"
      card
      lead={<IconBox icon={MessageSquare} className="bg-purple-50 text-purple-600" />}
      title={unreadRoomsLabel(rooms)}
      side={goTo('메시지')}
      onOpen={onOpenChat}
    />,
  ]
  return (
    <HomeCard
      title={WORK}
      icon={ClipboardList}
      read={{ kind: 'ready', total: rows.length, rows }}
      empty="맡은 업무 없음"
      aside="바로가기"
    />
  )
}
