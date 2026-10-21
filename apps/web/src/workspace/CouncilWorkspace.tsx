import { useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import PagePushBand from './PagePushBand'
import type { Opener, Page, WorkspaceProps } from './pages'
import { pageTitles } from './pages'
import { useCouncilData } from './useCouncilData'
import { useWorkspaceLists } from './useWorkspaceLists'
import { useWorkspaceNav } from './useWorkspaceNav'
import WorkspaceContent from './WorkspaceContent'
import WorkspaceFrame from './WorkspaceFrame'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar from './WorkspaceSidebar'

type Props = Omit<WorkspaceProps, 'initialCouncilId' | 'chatLink'> & {
  council: MyCouncil
  onSelect: (councilId: string, from: Opener) => void
  returnFocusTo: Opener | null
  startPage: Page
  // 알림으로 열 방. 대화가 이 방에서 시작한다.
  roomId: string | undefined
}

// 알림으로 연 방은 한 번만 쓴다. 다른 화면으로 가면 버리고, 대화로 돌아오면 방 목록이 열린다.
function useOnceRoom(linked: string | undefined, page: Page) {
  const [roomId, setRoomId] = useState(linked)
  if (roomId && page !== 'chat') setRoomId(undefined)
  return roomId
}

export default function CouncilWorkspace({
  council,
  councils,
  onSelect,
  returnFocusTo,
  startPage,
  roomId: linkedRoom,
  user,
  logoutBusy,
  onLogout,
  onCouncilsChanged,
  onCouncilLost,
}: Props) {
  const data = useCouncilData(council.id, onCouncilLost, onCouncilsChanged)
  const nav = useWorkspaceNav(returnFocusTo, startPage)
  const roomId = useOnceRoom(linkedRoom, nav.page)
  const { rooms, unread, tasks, taskCount } = useWorkspaceLists(council.id, data)
  const sidebar = (from: Opener) => (
    <WorkspaceSidebar
      council={council}
      councils={councils}
      view={data.view}
      page={nav.page}
      unread={unread}
      taskCount={taskCount}
      user={user}
      logoutBusy={logoutBusy}
      onLogout={onLogout}
      menuRef={from === 'sidebar' ? nav.councilMenu : undefined}
      onSelect={councilId => {
        nav.closeNav()
        onSelect(councilId, from)
      }}
      onPage={nav.openPage}
    />
  )
  return (
    <WorkspaceFrame sidebar={sidebar} navOpen={nav.navOpen} onNavOpenChange={nav.setNavOpen}>
      <WorkspaceHeader
        councilName={council.name}
        section={pageTitles[nav.page].section}
        title={pageTitles[nav.page].title}
        menuRef={nav.headerMenu}
        onMenu={() => nav.setNavOpen(true)}
      />
      <PagePushBand page={nav.page} />
      <WorkspaceContent data={data} rooms={rooms} tasks={tasks} page={nav.page} roomId={roomId} />
    </WorkspaceFrame>
  )
}
