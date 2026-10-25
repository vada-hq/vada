import { useState, type ComponentProps } from 'react'
import type { EventTab, MyCouncil, RecordKind } from '@vada/contracts'
import LeaveConfirm from '@/components/LeaveConfirm'
import { PageActionsProvider } from '@/components/PageActions'
import { navigate, useHere } from '@/lib/app-location'
import { recordTarget } from './address'
import PagePushBand from './PagePushBand'
import type { Opener, WorkspaceProps } from './pages'
import { pageTitles } from './pages'
import { useCouncilData } from './useCouncilData'
import { useWorkspaceLists } from './useWorkspaceLists'
import { useWorkspaceNav } from './useWorkspaceNav'
import WorkspaceContent from './WorkspaceContent'
import WorkspaceFrame from './WorkspaceFrame'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar from './WorkspaceSidebar'

type Props = WorkspaceProps & {
  council: MyCouncil
  onSelect: (councilId: string, from: Opener) => void
  returnFocusTo: Opener | null
}

type Nav = ReturnType<typeof useWorkspaceNav>

// 주소로 연 기록을 페이지가 한 번 여는 값. 칸(key)이 바뀌면 페이지가 새로 열려, 같은 알림을 또 눌러도 닫았던 상세가 다시 열린다.
function recordOf(target: Props['target']) {
  const { kind, id, tab } = target.record ?? { kind: null, id: undefined, tab: undefined }
  return {
    roomId: kind === 'chat' ? id : undefined,
    taskId: kind === 'tasks' ? id : undefined,
    requestId: kind === 'purchases' ? id : undefined,
    eventId: kind === 'events' ? id : undefined,
    eventTab: kind === 'events' ? tab : undefined,
  }
}

// 화면이 누르는 이동은 주소를 쌓는 것이다. 기록은 그 종류의 주소로 연다.
function useOpeners(councilId: string, nav: Nav) {
  const open = (kind: RecordKind, id: string, tab?: EventTab) =>
    navigate(recordTarget(kind, councilId, id, tab))
  return {
    onOpenPage: nav.openPage,
    onOpenTask: (id: string) => open('tasks', id),
    onOpenRequest: (id: string) => open('purchases', id),
    onOpenEvent: (id: string, tab?: EventTab) => open('events', id, tab),
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
  target,
  onSelect,
  returnFocusTo,
  user,
  logoutBusy,
  onLogout,
  onCouncilsChanged,
  onCouncilLost,
}: Props) {
  const here = useHere()
  const data = useCouncilData(council.id, onCouncilLost, onCouncilsChanged)
  const nav = useWorkspaceNav(returnFocusTo, council.id, target.page)
  const openers = useOpeners(council.id, nav)
  const { lists, counts } = useWorkspaceLists(council.id, data)
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
        content={{
          data,
          ...lists,
          ...openers,
          ...recordOf(target),
          linkKey: target.record || here.released ? here.key : '',
          mainRef: nav.main,
        }}
      />
      <LeaveConfirm />
    </WorkspaceFrame>
  )
}
