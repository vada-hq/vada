import type { Ref } from 'react'
import { CalendarDays, Clipboard, House, Menu, MessageSquare } from 'lucide-react'
import { BottomTabs, type BottomTab } from '@/components/ui/bottom-tabs'
import { CountBadge } from '@/components/ui/count-badge'
import { useBottomNavigationHidden } from '@/components/BottomNavigationVisibility'
import { useWideNavigation } from '@/lib/use-wide-navigation'
import { overdueLabel, type TaskCount } from '../tasks/task-view'
import type { Page } from './pages'
import { menuActive, type ActiveItem } from './space-view'

const ITEMS = [
  { key: 'home', label: '홈', icon: House },
  { key: 'chat', label: '메시지', icon: MessageSquare },
  { key: 'tasks', label: '업무', icon: Clipboard },
  { key: 'events', label: '행사', icon: CalendarDays },
  { key: 'menu', label: '메뉴', icon: Menu },
] as const

export default function MobileNavigation({
  active,
  unread,
  taskCount,
  onPage,
  onMenu,
  menuRef,
  className,
}: {
  active: ActiveItem
  unread: number
  taskCount: TaskCount | null
  onPage: (page: Page) => void
  onMenu: () => void
  menuRef?: Ref<HTMLButtonElement>
  className?: string
}) {
  const hidden = useBottomNavigationHidden()
  const wide = useWideNavigation()
  if (wide) return null
  const items: BottomTab[] = ITEMS.map(item => ({
    ...item,
    active: menuActive(active, item.key, 'mobile'),
    ref: item.key === 'menu' ? menuRef : undefined,
    onClick: () => (item.key === 'menu' ? onMenu() : onPage(item.key)),
    badge:
      item.key === 'chat' ? (
        <CountBadge count={unread} label={`안 읽은 메시지 ${unread}개`} />
      ) : item.key === 'tasks' && taskCount ? (
        <CountBadge count={taskCount.count} more={taskCount.more} label={overdueLabel(taskCount)} />
      ) : undefined,
  }))
  // 숨길 때도 단추를 보존해서 서랍을 닫으면 연 단추로 초점을 돌린다.
  return <BottomTabs items={items} hidden={hidden} className={className} />
}
