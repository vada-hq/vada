import { Network, Users } from 'lucide-react'
import { NavItem } from '@/components/ui/nav-item'
import type { Page } from './pages'

// 옆 메뉴 가운데: 바탕에서는 운영진(사람, 부서)만 있다.
export default function SidebarNav({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return (
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <p className="px-3 pb-1 text-xs font-medium text-gray-400">운영진</p>
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
