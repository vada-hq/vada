import type { ReactNode } from 'react'
import {
  BarChart3,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Ellipsis,
  FileText,
  Home,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  MessageSquare,
  Bell,
  ShoppingCart,
  User,
  Users,
  Presentation,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BottomTabs } from '@/components/ui/bottom-tabs'
import { Button } from '@/components/ui/button'
import { NavItem } from '@/components/ui/nav-item'
import { TabButton } from '@/components/ui/tab-button'

// 미리보기 틀: 지금 배포본의 옆 메뉴(240px)·머리글·행사 공통 머리(DEC-93)를 지금 모양 그대로 흉내 내고,
// 그 아래 업무 탭 자리에 안의 보드를 둔다. 실제 작업 공간·가짜 API를 띄우지 않고 지금 부품의 클래스를 옮겨 그렸다.
// 넓은 화면(1024 이상)은 desktop, 그 아래는 mobile(상태 탭 + 목록, DEC-94). 768 아래는 옆 메뉴 대신 아래 탭 막대.

const NAV = [
  { icon: Home, label: '홈' },
  { icon: MessageSquare, label: '메시지' },
  { icon: ClipboardList, label: '업무' },
  { icon: Presentation, label: '회의' },
  { icon: Calendar, label: '캘린더' },
  { icon: ShoppingCart, label: '구매' },
  { icon: BarChart3, label: '재정' },
  { icon: FileText, label: '기록' },
  { icon: Users, label: '조직' },
]
const SPACES = [
  { mark: '기', name: '기말고사 간식행사', state: '기획 중', active: false },
  { mark: '새', name: '새내기 배움터', state: '기획 중', active: true },
]

function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-white md:flex">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded bg-primary text-sm font-bold text-white">
          V
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-fg">Vada</span>
          <span className="text-xs text-fg-muted">컴퓨터공학과</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 text-fg-subtle" />
      </div>
      <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {NAV.map(({ icon: Icon, label }) => (
          <NavItem key={label}>
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
          </NavItem>
        ))}
        <p className="px-3 pt-4 pb-1.5 text-xs font-semibold text-fg-muted">행사</p>
        {SPACES.map(space => (
          <NavItem
            key={space.name}
            aria-current={space.active ? 'page' : undefined}
            className="gap-2"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-surface-muted text-xs font-bold text-fg-tertiary">
              {space.mark}
            </span>
            <span className="min-w-0 flex-1 truncate">{space.name}</span>
            <span className="shrink-0 text-xs text-fg-muted">{space.state}</span>
          </NavItem>
        ))}
        <NavItem className="text-xs text-fg-muted">전체 행사 보기</NavItem>
        <NavItem className="gap-1 text-primary-strong">
          <Plus aria-hidden className="size-4" />새 행사
        </NavItem>
      </nav>
      <footer className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-surface-muted">
          <User aria-hidden className="size-4 text-fg-muted" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium text-fg-secondary">김바다</span>
          <span className="text-xs text-fg-muted">재정부 · 회장</span>
        </span>
        <Bell aria-hidden className="size-4 text-fg-muted" />
        <LogOut aria-hidden className="size-4 text-fg-muted" />
      </footer>
    </aside>
  )
}

function Header() {
  return (
    <header className="flex min-h-16 shrink-0 items-center overflow-hidden border-b bg-white px-4 py-2 sm:px-6">
      <div className="flex w-full items-center gap-4">
        <div className="min-w-0 flex-1">
          <ol aria-label="경로" className="flex min-w-0 items-center gap-1 text-xs text-fg-muted">
            {['컴퓨터공학과', '행사', '새내기 배움터', '업무'].map((crumb, index) => (
              <li key={crumb} className="flex min-w-0 items-center gap-1">
                {index > 0 && <ChevronRight aria-hidden className="size-3 shrink-0" />}
                <span className="truncate">{crumb}</span>
              </li>
            ))}
          </ol>
          <p className="mt-0.5 line-clamp-1 text-xl font-semibold text-fg">새내기 배움터</p>
        </div>
        <Button>업무 추가</Button>
        <Button variant="ghost" size="icon" aria-label="더 보기">
          <Ellipsis />
        </Button>
      </div>
    </header>
  )
}

const EVENT_TABS = ['메시지', '개요', '업무', '회의', '구매', '인원 관리']

// 행사 공통 머리(DEC-93): '< 행사 목록', 탭, 요약 줄. EventDetailView·EventStatusBar 클래스 그대로.
function EventHead() {
  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-3 self-start">
        <ChevronLeft aria-hidden />
        행사 목록
      </Button>
      <div className="flex flex-col">
        <div role="tablist" aria-label="행사 보기" className="flex overflow-x-auto border-b">
          {EVENT_TABS.map(tab => (
            <TabButton key={tab} aria-selected={tab === '업무'} className="gap-1.5 max-sm:px-2.5">
              {tab}
            </TabButton>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-b py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">기획 중</Badge>
              <Badge tone="warning">주의 · 담당자 없는 업무 2개</Badge>
            </div>
            <span aria-hidden className="hidden h-4 border-l lg:block" />
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span>담당 기획부, 재정부, 홍보부 · 김바다</span>
              <span className="flex items-center gap-1">
                <CalendarDays aria-hidden className="size-3.5 text-fg-subtle" />
                2월 23일 (화) 10:00 ~ 2월 25일 (목) 12:00
              </span>
              <span className="flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5 text-fg-subtle" />
                가평 베이직하우스
              </span>
              <span>다음 일정 · 10월 30일 (금) 숙소 계약금 결제</span>
            </div>
          </div>
          <div className="flex shrink-0 justify-end">
            <Button variant="outline" size="sm">
              기본정보 수정
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

const BOTTOM = [
  { key: 'home', label: '홈', icon: Home },
  { key: 'chat', label: '메시지', icon: MessageSquare },
  { key: 'tasks', label: '업무', icon: ClipboardList },
  { key: 'events', label: '행사', icon: Calendar },
  { key: 'menu', label: '메뉴', icon: MenuIcon },
]

// board: 넓은 화면(lg 이상) 보드, list: 그 아래 상태 탭 + 목록. 둘 다 안이 그린다.
export function Frame({ board, list }: { board: ReactNode; list: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          data-board-scroll
          className="min-h-0 flex-1 overflow-y-auto p-4 max-md:pb-20 sm:p-6 md:scrollbar-gutter-stable"
        >
          <div className="flex w-full flex-col gap-4">
            <EventHead />
            <div data-board-root className="hidden lg:block">
              {board}
            </div>
            <div data-list-root className="lg:hidden">
              {list}
            </div>
          </div>
        </main>
      </div>
      <BottomTabs
        items={BOTTOM.map(item => ({ ...item, active: item.key === 'events', onClick: () => {} }))}
      />
    </div>
  )
}
