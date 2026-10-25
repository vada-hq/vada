import { House, ListChecks, MessageSquare, Network, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { NavItem } from '@/components/ui/nav-item'
import { unreadLabel } from '../chat/chat-view'
import type { PendingCount } from '../finance/purchase-view'
import type { TaskCount } from '../tasks/task-view'
import type { Page } from './pages'
import SpaceList, { type SpaceProps } from './SpaceList'
import { menuActive, type ActiveItem } from './space-view'

function TasksItem({
  active,
  count,
  onClick,
}: {
  active: boolean
  count: TaskCount | null
  onClick: () => void
}) {
  return (
    <NavItem active={active} className="mt-1 flex items-center gap-2" onClick={onClick}>
      <ListChecks aria-hidden className="size-4" />
      <span className="flex-1">업무</span>
      {count && (
        <Badge tone={count.tone} aria-label={count.description}>
          {count.label}
        </Badge>
      )}
    </NavItem>
  )
}

// 재정: 재정부에게만 결재 대기 수가 보인다(count가 없으면 배지가 없다).
function FinanceItem({
  active,
  count,
  onClick,
}: {
  active: boolean
  count: PendingCount | null
  onClick: () => void
}) {
  return (
    <NavItem active={active} className="mt-1 flex items-center gap-2" onClick={onClick}>
      <Wallet aria-hidden className="size-4" />
      <span className="flex-1">재정</span>
      {count && (
        <Badge tone="warning" aria-label={count.description}>
          {count.label}
        </Badge>
      )}
    </NavItem>
  )
}

// 운영진: 사람, 부서
function TeamItems({ active, onPage }: { active: ActiveItem; onPage: (page: Page) => void }) {
  return (
    <>
      <p className="px-3 pt-3 pb-1 text-xs font-medium text-gray-500">운영진</p>
      <NavItem
        active={menuActive(active, 'people')}
        className="flex items-center gap-2"
        onClick={() => onPage('people')}
      >
        <Users aria-hidden className="size-4" />
        사람
      </NavItem>
      <NavItem
        active={menuActive(active, 'departments')}
        className="flex items-center gap-2"
        onClick={() => onPage('departments')}
      >
        <Network aria-hidden className="size-4" />
        부서
      </NavItem>
    </>
  )
}

// 홈(배지 없음), 대화(안 읽은 수 합계). 행사는 최상위 칸이 아니고 아래 '공간' 묶음이다(DEC-85, DEC-96).
function LeadItems({
  active,
  unread,
  onPage,
}: {
  active: ActiveItem
  unread: number
  onPage: (page: Page) => void
}) {
  return (
    <>
      <NavItem
        active={menuActive(active, 'home')}
        className="flex items-center gap-2"
        onClick={() => onPage('home')}
      >
        <House aria-hidden className="size-4" />홈
      </NavItem>
      <NavItem
        active={menuActive(active, 'chat')}
        className="mt-1 flex items-center gap-2"
        onClick={() => onPage('chat')}
      >
        <MessageSquare aria-hidden className="size-4" />
        <span className="flex-1">대화</span>
        {unread > 0 && (
          <Badge tone="info" aria-label={`안 읽은 메시지 ${unread}개`}>
            {unreadLabel(unread)}
          </Badge>
        )}
      </NavItem>
    </>
  )
}

// 옆 메뉴 가운데: 홈(배지 없음), 대화(안 읽은 수 합계), 업무(지남 또는 남은 수), 재정(결재 대기 수), 운영진(사람, 부서),
// 그 아래 '공간'(완료하지 않은 행사, 행사 모두 보기, 새 행사).
export default function SidebarNav({
  active,
  unread,
  taskCount,
  pendingCount,
  space,
  onPage,
}: {
  active: ActiveItem
  unread: number
  taskCount: TaskCount | null
  pendingCount: PendingCount | null
  space: SpaceProps
  onPage: (page: Page) => void
}) {
  return (
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <LeadItems active={active} unread={unread} onPage={onPage} />
      <TasksItem
        active={menuActive(active, 'tasks')}
        count={taskCount}
        onClick={() => onPage('tasks')}
      />
      <FinanceItem
        active={menuActive(active, 'finance')}
        count={pendingCount}
        onClick={() => onPage('finance')}
      />
      <TeamItems active={active} onPage={onPage} />
      <SpaceList active={active} {...space} />
    </nav>
  )
}
