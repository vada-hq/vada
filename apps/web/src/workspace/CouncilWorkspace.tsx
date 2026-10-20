import type { MyCouncil } from '@vada/contracts'
import type { Opener, WorkspaceProps } from './pages'
import { pageTitles } from './pages'
import { useCouncilData } from './useCouncilData'
import { useWorkspaceNav } from './useWorkspaceNav'
import WorkspaceContent from './WorkspaceContent'
import WorkspaceFrame from './WorkspaceFrame'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar from './WorkspaceSidebar'

type Props = Omit<WorkspaceProps, 'initialCouncilId'> & {
  council: MyCouncil
  onSelect: (councilId: string, from: Opener) => void
  returnFocusTo: Opener | null
}

export default function CouncilWorkspace({
  council,
  councils,
  onSelect,
  returnFocusTo,
  user,
  logoutBusy,
  onLogout,
  onCouncilsChanged,
  onCouncilLost,
}: Props) {
  const { state, view, reload, saved, team } = useCouncilData(
    council.id,
    onCouncilLost,
    onCouncilsChanged,
  )
  const nav = useWorkspaceNav(returnFocusTo)
  const sidebar = (from: Opener) => (
    <WorkspaceSidebar
      council={council}
      councils={councils}
      view={view}
      page={nav.page}
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
      <WorkspaceContent state={state} page={nav.page} team={team} reload={reload} onSaved={saved} />
    </WorkspaceFrame>
  )
}
