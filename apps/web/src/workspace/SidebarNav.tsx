import {
  CalendarDays,
  House,
  ListChecks,
  MessageSquare,
  Network,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { NavItem } from '@/components/ui/nav-item'
import { unreadLabel } from '../chat/chat-view'
import type { PendingCount } from '../finance/purchase-view'
import type { TaskCount } from '../tasks/task-view'
import type { Page } from './pages'

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
function TeamItems({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return (
    <>
      <p className="px-3 pt-3 pb-1 text-xs font-medium text-gray-500">운영진</p>
      <NavItem
        active={page === 'people'}
        className="flex items-center gap-2"
        onClick={() => onPage('people')}
      >
        <Users aria-hidden className="size-4" />
        사람
      </NavItem>
      <NavItem
        active={page === 'departments'}
        className="flex items-center gap-2"
        onClick={() => onPage('departments')}
      >
        <Network aria-hidden className="size-4" />
        부서
      </NavItem>
    </>
  )
}

// 홈(배지 없음), 대화(안 읽은 수 합계), 행사.
function LeadItems({
  page,
  unread,
  onPage,
}: {
  page: Page
  unread: number
  onPage: (page: Page) => void
}) {
  return (
    <>
      <NavItem
        active={page === 'home'}
        className="flex items-center gap-2"
        onClick={() => onPage('home')}
      >
        <House aria-hidden className="size-4" />홈
      </NavItem>
      <NavItem
        active={page === 'chat'}
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
      <NavItem
        active={page === 'events'}
        className="mt-1 flex items-center gap-2"
        onClick={() => onPage('events')}
      >
        <CalendarDays aria-hidden className="size-4" />
        행사
      </NavItem>
    </>
  )
}

// 옆 메뉴 가운데: 홈(배지 없음), 대화(안 읽은 수 합계), 행사, 업무(지남 또는 남은 수), 재정(결재 대기 수), 운영진(사람, 부서).
export default function SidebarNav({
  page,
  unread,
  taskCount,
  pendingCount,
  onPage,
}: {
  page: Page
  unread: number
  taskCount: TaskCount | null
  pendingCount: PendingCount | null
  onPage: (page: Page) => void
}) {
  return (
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <LeadItems page={page} unread={unread} onPage={onPage} />
      <TasksItem active={page === 'tasks'} count={taskCount} onClick={() => onPage('tasks')} />
      <FinanceItem
        active={page === 'finance'}
        count={pendingCount}
        onClick={() => onPage('finance')}
      />
      <TeamItems page={page} onPage={onPage} />
    </nav>
  )
}
