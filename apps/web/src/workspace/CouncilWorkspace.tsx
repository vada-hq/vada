import { useState, type ComponentProps } from 'react'
import type { EventTab, MyCouncil } from '@vada/contracts'
import LeaveConfirm from '@/components/LeaveConfirm'
import { PageActionsProvider } from '@/components/PageActions'
import { useHere } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { useScrollMemory } from '@/lib/use-scroll-memory'
import { NewEventDialog } from '../events/EventCreateDialog'
import PagePushBand from './PagePushBand'
import type { Opener, WorkspaceProps } from './pages'
import { pageTitles } from './pages'
import { activeItemOf } from './space-view'
import { useCouncilData } from './useCouncilData'
import { useSpace } from './useSpace'
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
  const { kind, id } = target.record ?? { kind: null, id: undefined }
  return {
    taskId: kind === 'tasks' ? id : undefined,
  }
}

// 기록 주소의 칸이 바뀌면 페이지를 새로 열어 주소로 연 기록을 다시 연다. 대화의 방은 주소만 바꿔 그대로 둔다(방을 바꿔도 쓰던 입력이 남는다).
// 행사는 화면이 주소를 읽어 그리므로 탭을 바꿔 쓸 때 새로 열지 않는다.
const pageOpensAnew = (target: Props['target'], released: boolean) =>
  (target.record !== null && target.record.kind !== 'chat' && target.record.kind !== 'events') ||
  released

// 화면이 누르는 이동은 주소를 쌓는 것이다. 기록은 그 종류의 주소로 연다.
function useOpeners(councilId: string, nav: Nav) {
  return {
    onOpenPage: nav.openPage,
    onOpenEvent: (id: string, tab?: EventTab) => openRecord('events', councilId, id, { tab }),
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
  const nav = useWorkspaceNav(
    returnFocusTo,
    council.id,
    target.page,
    data.view?.me.memberId ?? null,
  )
  // 본문 위치는 방문 기록 칸마다 기억한다. 직접 연 첫 칸은 표시가 없어 주소로 가른다.
  useScrollMemory(nav.main, here.key || `path:${here.path}`)
  const openers = useOpeners(council.id, nav)
  const { lists, counts, openEvents } = useWorkspaceLists(council.id, data)
  const { space, newEvent } = useSpace(data, nav, openEvents)
  const openEventId = target.record?.kind === 'events' ? target.record.id : null
  const sidebar = (from: Opener) => (
    <WorkspaceSidebar
      council={council}
      councils={councils}
      view={data.view}
      active={activeItemOf(nav.page, openEventId, openEvents ?? [])}
      space={space}
      {...counts}
      user={user}
      logoutBusy={logoutBusy}
      onLogout={onLogout}
      // 내 이름은 학생회 보기(사용자 줄)와 운영진 목록에 함께 나온다. 이름 바꾸기는 내 권한을 바꾸지 않으므로
      // 내 변경의 읽기(own)로 두지 않는다. 그사이 다른 사람이 바꾼 권한은 바깥 변경으로 알린다.
      onRenamed={() => {
        data.reload()
        data.team.reload()
      }}
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
          linkKey: pageOpensAnew(target, here.released) ? here.key : '',
          mainRef: nav.main,
        }}
      />
      {newEvent.open && data.view && (
        <NewEventDialog
          view={data.view}
          onClose={newEvent.close}
          onLost={newEvent.lose}
          onForbidden={data.reload}
        />
      )}
      <LeaveConfirm />
    </WorkspaceFrame>
  )
}
