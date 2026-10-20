import { MessageSquare, Network, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { NavItem } from '@/components/ui/nav-item'
import { unreadLabel } from '../chat/chat-view'
import type { Page } from './pages'

// 옆 메뉴 가운데: 대화(안 읽은 수 합계)와 운영진(사람, 부서).
export default function SidebarNav({
  page,
  unread,
  onPage,
}: {
  page: Page
  unread: number
  onPage: (page: Page) => void
}) {
  return (
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <NavItem
        active={page === 'chat'}
        className="flex items-center gap-2"
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
      <p className="px-3 pt-3 pb-1 text-xs font-medium text-gray-400">운영진</p>
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
    </nav>
  )
}
