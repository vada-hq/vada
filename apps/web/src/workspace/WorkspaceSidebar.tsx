import type { Ref } from 'react'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import CouncilMenu from './CouncilMenu'
import type { TaskCount } from '../tasks/task-view'
import type { CouncilEntry, Page } from './pages'
import SidebarFooter from './SidebarFooter'
import SidebarNav from './SidebarNav'
import type { ActiveItem } from './space-view'
import type { SpaceProps } from './SpaceList'

type Props = {
  onAddCouncil?: ((entry: CouncilEntry) => void) | undefined
  council: MyCouncil
  councils: MyCouncil[]
  view: CouncilView | null
  // 켤 칸 하나(메뉴, 공간의 행사 줄, 행사 모두 보기)
  active: ActiveItem
  unread: number
  taskCount: TaskCount | null
  space: SpaceProps
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  // 머리 칸(학생회 메뉴 단추). 학생회를 바꾼 뒤 포커스를 돌려놓을 때 쓴다.
  menuRef?: Ref<HTMLButtonElement> | undefined
  // 휴대폰 서랍 안에 그린다.
  inSheet?: boolean
  user: { id: string; name: string; email: string }
  logoutBusy: boolean
  onLogout: () => void
  onRenamed: () => void
}

// 옆 메뉴(와이어프레임 사이드바 v6.2, 240px): 위 머리(학생회 메뉴 단추), 가운데 메뉴, 아래 사용자 줄.
// 데스크톱 aside와 휴대폰 옆 메뉴(시트)가 같이 쓴다.
export default function WorkspaceSidebar({
  council,
  councils,
  view,
  active,
  unread,
  taskCount,
  space,
  onSelect,
  onPage,
  menuRef,
  inSheet = false,
  user,
  logoutBusy,
  onLogout,
  onRenamed,
  onAddCouncil,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <CouncilMenu
        council={council}
        councils={councils}
        onSelect={onSelect}
        onPage={onPage}
        menuRef={menuRef}
        inSheet={inSheet}
        onAddCouncil={onAddCouncil}
      />
      <SidebarNav
        active={active}
        unread={unread}
        taskCount={taskCount}
        space={space}
        onPage={onPage}
      />
      <SidebarFooter
        view={view}
        user={user}
        logoutBusy={logoutBusy}
        onLogout={onLogout}
        onRenamed={onRenamed}
      />
    </div>
  )
}
