import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  ChartNoAxesColumn,
  Clipboard,
  FileText,
  House,
  MessageSquare,
  Presentation,
  ShoppingCart,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { CountBadge } from '@/components/ui/count-badge'
import { NavItem } from '@/components/ui/nav-item'
import { overdueLabel, type TaskCount } from '../tasks/task-view'
import type { Page } from './pages'
import SpaceList, { type SpaceProps } from './SpaceList'
import { menuActive, type ActiveItem } from './space-view'

// 최상위 칸 하나: 아이콘, 이름, 오른쪽 끝의 수 배지(있으면).
function TopItem({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  badge?: ReactNode
  onClick: () => void
}) {
  return (
    <NavItem active={active} className="min-h-11 break-keep md:min-h-0" onClick={onClick}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge}
    </NavItem>
  )
}

// 옆 메뉴 가운데(DEC-103): 홈 · 메시지(안 읽은 수 합계) · 업무('지남 N') · 회의 · 캘린더 · 구매 · 재정 · 기록(DEC-110) · 조직,
// 그 아래 '행사'(완료하지 않은 행사, 전체 행사 보기, 새 행사). 수 배지는 나에게 걸린 것 둘뿐이다.
// 아이콘은 와이어프레임 그대로(홈 House, 업무 Clipboard, 재정 막대그래프 BarChart2 = ChartNoAxesColumn, 조직 Users). 메시지는 말풍선이다.
// 조직은 사람과 부서를 한 화면에서(DEC-91) 보고 옛 부서 주소도 이 칸이 켜진다. '운영진' 머리는 없다.
export default function SidebarNav({
  active,
  unread,
  taskCount,
  space,
  onPage,
}: {
  active: ActiveItem
  unread: number
  taskCount: TaskCount | null
  space: SpaceProps
  onPage: (page: Page) => void
}) {
  return (
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <TopItem
        icon={House}
        label="홈"
        active={menuActive(active, 'home')}
        onClick={() => onPage('home')}
      />
      <TopItem
        icon={MessageSquare}
        label="메시지"
        active={menuActive(active, 'chat')}
        badge={<CountBadge count={unread} label={`안 읽은 메시지 ${unread}개`} />}
        onClick={() => onPage('chat')}
      />
      <TopItem
        icon={Clipboard}
        label="업무"
        active={menuActive(active, 'tasks')}
        badge={
          taskCount && (
            <CountBadge
              count={taskCount.count}
              prefix="지남"
              more={taskCount.more}
              label={overdueLabel(taskCount)}
            />
          )
        }
        onClick={() => onPage('tasks')}
      />
      <TopItem
        icon={Presentation}
        label="회의"
        active={menuActive(active, 'meetings')}
        onClick={() => onPage('meetings')}
      />
      <TopItem
        icon={CalendarDays}
        label="캘린더"
        active={menuActive(active, 'calendar')}
        onClick={() => onPage('calendar')}
      />
      <TopItem
        icon={ShoppingCart}
        label="구매"
        active={menuActive(active, 'purchases')}
        onClick={() => onPage('purchases')}
      />
      <TopItem
        icon={ChartNoAxesColumn}
        label="재정"
        active={menuActive(active, 'finance')}
        onClick={() => onPage('finance')}
      />
      <TopItem
        icon={FileText}
        label="기록"
        active={menuActive(active, 'records')}
        onClick={() => onPage('records')}
      />
      <TopItem
        icon={Users}
        label="조직"
        active={menuActive(active, 'people') || menuActive(active, 'departments')}
        onClick={() => onPage('people')}
      />
      <SpaceList active={active} {...space} />
    </nav>
  )
}
