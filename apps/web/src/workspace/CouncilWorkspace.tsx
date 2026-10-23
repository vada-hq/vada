import { useState, type ComponentProps } from 'react'
import type { MyCouncil } from '@vada/contracts'
import { PageActionsProvider } from '@/components/PageActions'
import type { EventTab } from '../events/event-view'
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
  // 알림으로 열 업무. 업무 화면이 이 업무의 상세를 열고 시작한다.
  taskId?: string | undefined
  // 알림으로 열 구매 요청. 재정 화면이 이 요청의 상세를 열고 시작한다.
  requestId?: string | undefined
}

// 알림으로 연 방이나 업무는 한 번만 쓴다. 다른 화면으로 가면 버리고, 돌아오면 목록이 열린다.
function useOnceLinked(linked: string | undefined, page: Page, own: Page) {
  const [id, setId] = useState(linked)
  if (id && page !== own) setId(undefined)
  return [id, setId] as const
}

type Nav = ReturnType<typeof useWorkspaceNav>

// 알림으로 열 방, 업무, 요청. 각각 한 번만 쓴다. 업무는 홈의 줄을 눌러서도 연다(onOpenTask).
function useLinkedIds(nav: Nav, room?: string, task?: string, request?: string) {
  const [taskId, setTaskId] = useOnceLinked(task, nav.page, 'tasks')
  const [requestId, setRequestId] = useOnceLinked(request, nav.page, 'finance')
  return {
    roomId: useOnceLinked(room, nav.page, 'chat')[0],
    taskId,
    requestId,
    onOpenPage: nav.openPage,
    onOpenTask: (id: string) => {
      setTaskId(id)
      nav.openPage('tasks')
    },
    onOpenRequest: (id: string) => {
      setRequestId(id)
      nav.openPage('finance')
    },
  }
}

// 업무에서 눌러 연 행사. 행사 화면으로 가면서 한 번만 쓰고, 다른 화면으로 가면 버린다.
function useEventLink(nav: Nav) {
  const [link, setLink] = useState<{ id: string; tab: EventTab | undefined }>()
  if (link && nav.page !== 'events') setLink(undefined)
  return {
    eventId: link?.id,
    eventTab: link?.tab,
    onOpenEvent: (id: string, tab?: EventTab) => {
      setLink({ id, tab })
      nav.openPage('events')
    },
  }
}

// 위 줄(학생회 이름, 화면 이름, 페이지 행동), 휴대폰 알림 안내, 본문.
function CouncilMain({
  council,
  nav,
  content,
}: {
  council: MyCouncil
  nav: Nav
  content: Omit<ComponentProps<typeof WorkspaceContent>, 'page'>
}) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <WorkspaceHeader
        councilName={council.name}
        section={pageTitles[nav.page].section}
        title={pageTitles[nav.page].title}
        menuRef={nav.headerMenu}
        onMenu={() => nav.setNavOpen(true)}
        actionsRef={setActions}
      />
      <PagePushBand page={nav.page} />
      <PageActionsProvider value={actions}>
        <WorkspaceContent {...content} page={nav.page} />
      </PageActionsProvider>
    </>
  )
}

export default function CouncilWorkspace({
  council,
  councils,
  onSelect,
  returnFocusTo,
  startPage,
  roomId: linkedRoom,
  taskId: linkedTask,
  requestId: linkedRequest,
  user,
  logoutBusy,
  onLogout,
  onCouncilsChanged,
  onCouncilLost,
}: Props) {
  const data = useCouncilData(council.id, onCouncilLost, onCouncilsChanged)
  const nav = useWorkspaceNav(returnFocusTo, startPage)
  const linked = useLinkedIds(nav, linkedRoom, linkedTask, linkedRequest)
  const { lists, counts } = useWorkspaceLists(council.id, data)
  const eventLink = useEventLink(nav)
  const sidebar = (from: Opener) => (
    <WorkspaceSidebar
      council={council}
      councils={councils}
      view={data.view}
      page={nav.page}
      {...counts}
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
      <CouncilMain
        council={council}
        nav={nav}
        content={{ data, ...lists, ...linked, ...eventLink }}
      />
    </WorkspaceFrame>
  )
}
