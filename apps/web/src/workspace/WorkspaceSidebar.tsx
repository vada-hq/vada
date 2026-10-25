import type { Ref } from 'react'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import CouncilMenu from './CouncilMenu'
import type { PendingCount } from '../finance/purchase-view'
import type { TaskCount } from '../tasks/task-view'
import type { Page } from './pages'
import SidebarFooter from './SidebarFooter'
import SidebarNav from './SidebarNav'
import type { ActiveItem } from './space-view'
import type { SpaceProps } from './SpaceList'

type Props = {
  council: MyCouncil
  councils: MyCouncil[]
  view: CouncilView | null
  // 켤 칸 하나(메뉴, 공간의 행사 줄, 행사 모두 보기)
  active: ActiveItem
  unread: number
  taskCount: TaskCount | null
  pendingCount: PendingCount | null
  space: SpaceProps
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  // 학생회 이름 버튼. 학생회를 바꾼 뒤 포커스를 돌려놓을 때 쓴다.
  menuRef?: Ref<HTMLButtonElement> | undefined
  user: { id: string; name: string; email: string }
  logoutBusy: boolean
  onLogout: () => void
  onRenamed: () => void
}

// 옆 메뉴(와이어프레임 210px): 위 학생회 이름 메뉴, 가운데 메뉴, 아래 사용자 줄.
// 데스크톱 aside와 휴대폰 옆 메뉴(시트)가 같이 쓴다.
export default function WorkspaceSidebar({
  council,
  councils,
  view,
  active,
  unread,
  taskCount,
  pendingCount,
  space,
  onSelect,
  onPage,
  menuRef,
  user,
  logoutBusy,
  onLogout,
  onRenamed,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <CouncilMenu
        council={council}
        councils={councils}
        onSelect={onSelect}
        onPage={onPage}
        menuRef={menuRef}
      />
      <SidebarNav
        active={active}
        unread={unread}
        taskCount={taskCount}
        pendingCount={pendingCount}
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
