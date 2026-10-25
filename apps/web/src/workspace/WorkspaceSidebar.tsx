import type { Ref } from 'react'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import CouncilMenu from './CouncilMenu'
import type { PendingCount } from '../finance/purchase-view'
import type { TaskCount } from '../tasks/task-view'
import type { Page } from './pages'
import SidebarFooter from './SidebarFooter'
import SidebarNav from './SidebarNav'

type Props = {
  council: MyCouncil
  councils: MyCouncil[]
  view: CouncilView | null
  page: Page
  unread: number
  taskCount: TaskCount | null
  pendingCount: PendingCount | null
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  // 학생회 이름 버튼. 학생회를 바꾼 뒤 포커스를 돌려놓을 때 쓴다.
  menuRef?: Ref<HTMLButtonElement> | undefined
  user: { name: string }
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
  page,
  unread,
  taskCount,
  pendingCount,
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
        page={page}
        unread={unread}
        taskCount={taskCount}
        pendingCount={pendingCount}
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
