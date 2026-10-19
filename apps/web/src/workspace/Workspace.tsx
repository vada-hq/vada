import { useEffect, useRef, useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import CouncilSettings from '../settings/CouncilSettings'
import Departments from '../team/Departments'
import People from '../team/People'
import { useTeam } from '../team/useTeam'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useCouncilView } from './useCouncilView'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type Page } from './WorkspaceSidebar'

type Props = {
  councils: MyCouncil[]
  initialCouncilId?: string | undefined
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
  // 학생회 이름이 바뀌었을 때 내 학생회 목록을 다시 읽게 한다.
  onCouncilsChanged: () => void
  // 이 학생회의 운영진이 아니게 되었을 때(내보내졌거나 기수가 끝남). 목록을 다시 읽는 데 실패해도 이 학생회를 떠나게 한다.
  onCouncilLost: (councilId: string) => void
}
// 학생회를 고른 곳. 작업 공간이 새로 그려진 뒤 포커스를 그 자리의 버튼으로 돌려놓는다.
type Opener = 'sidebar' | 'header'
const titles: Record<Page, { section: string; title: string }> = {
  people: { section: '운영진', title: '사람' },
  departments: { section: '운영진', title: '부서' },
  settings: { section: '설정', title: '학생회 정보' },
}

// 작업 공간 틀. 방금 만들었거나 들어온 학생회가 있으면 그 학생회를 먼저 연다.
export default function Workspace({ councils, initialCouncilId, ...props }: Props) {
  const [councilId, setCouncilId] = useState(
    () => (councils.find(item => item.id === initialCouncilId) ?? councils[0])?.id,
  )
  const [picked, setPicked] = useState<{ councilId: string; from: Opener } | null>(null)
  const council = councils.find(item => item.id === councilId) ?? councils[0]
  if (!council) return null
  // 고른 학생회가 열릴 때만 포커스를 옮긴다. 학생회를 잃어 다른 학생회로 넘어갈 때는 옮기지 않는다.
  return (
    <CouncilWorkspace
      key={council.id}
      {...props}
      councils={councils}
      council={council}
      returnFocusTo={picked?.councilId === council.id ? picked.from : null}
      onSelect={(next, from) => {
        setPicked({ councilId: next, from })
        setCouncilId(next)
      }}
    />
  )
}

function CouncilWorkspace({
  council,
  councils,
  onSelect,
  returnFocusTo,
  user,
  logoutBusy,
  onLogout,
  onCouncilsChanged,
  onCouncilLost,
}: Omit<Props, 'initialCouncilId'> & {
  council: MyCouncil
  onSelect: (councilId: string, from: Opener) => void
  returnFocusTo: Opener | null
}) {
  const { state, reload, replace } = useCouncilView(council.id)
  const team = useTeam(council.id, reload)
  const [page, setPage] = useState<Page>('people')
  // 768px 미만에서 옆 메뉴로 연 시트. 메뉴를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    if (state.kind === 'lost') onCouncilLost(council.id)
  }, [state.kind, onCouncilLost, council.id])
  // 학생회를 고르면 이 작업 공간은 새로 그려진다. 고른 곳(옆 메뉴의 학생회 이름 버튼, 휴대폰 폭에서는 헤더의 메뉴 열기 버튼)으로 포커스를 돌려놓는다.
  const councilMenu = useRef<HTMLButtonElement>(null)
  const headerMenu = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (returnFocusTo) (returnFocusTo === 'sidebar' ? councilMenu : headerMenu).current?.focus()
  }, [returnFocusTo])
  const view = state.kind === 'ready' ? state.view : null
  const sidebar = (from: Opener) => (
    <WorkspaceSidebar
      council={council}
      councils={councils}
      view={view}
      page={page}
      user={user}
      logoutBusy={logoutBusy}
      onLogout={onLogout}
      menuRef={from === 'sidebar' ? councilMenu : undefined}
      onSelect={councilId => {
        setNavOpen(false)
        onSelect(councilId, from)
      }}
      onPage={next => {
        setNavOpen(false)
        setPage(next)
      }}
    />
  )
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col"
        aria-label="학생회 작업 공간"
      >
        {sidebar('sidebar')}
      </aside>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent title="학생회 작업 공간">{sidebar('header')}</SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader
          councilName={council.name}
          section={titles[page].section}
          title={titles[page].title}
          menuRef={headerMenu}
          onMenu={() => setNavOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {state.kind === 'lost' ? (
            <StateMessage kind="notice">
              이 학생회의 운영진이 아니게 되었어요. 학생회 목록으로 돌아가요.
            </StateMessage>
          ) : state.kind === 'failed' ? (
            <Card className="flex flex-col gap-3 p-6">
              <StateMessage kind="error">
                학생회를 불러오지 못했어요. 연결을 확인해 주세요.
              </StateMessage>
              <Button variant="outline" className="self-start" onClick={reload}>
                다시 시도
              </Button>
            </Card>
          ) : !view ? (
            <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
          ) : page === 'people' ? (
            <People view={view} team={team} onCouncilChanged={reload} />
          ) : page === 'departments' ? (
            <Departments view={view} team={team} />
          ) : (
            // 학생회 이름이 바뀌면 옆 메뉴와 학생회 고르기의 이름도 바뀌도록 내 학생회 목록을 다시 읽는다.
            <CouncilSettings
              view={view}
              onForbidden={reload}
              onSaved={next => {
                replace(next)
                onCouncilsChanged()
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}
