import { useEffect, useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
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
  initialCouncilId?: string
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
  // 학생회를 잃었을 때(내보내졌거나 기수가 끝남) 내 학생회 목록을 다시 읽게 한다.
  onCouncilsChanged: () => void
}
const titles: Record<Page, { section: string; title: string }> = { people: { section: '운영진', title: '사람' } }

// 작업 공간 틀. 방금 만들었거나 들어온 학생회가 있으면 그 학생회를 먼저 연다.
export default function Workspace({ councils, initialCouncilId, ...props }: Props) {
  const [councilId, setCouncilId] = useState(() => (councils.find(item => item.id === initialCouncilId) ?? councils[0])?.id)
  const council = councils.find(item => item.id === councilId) ?? councils[0]
  if (!council) return null
  return <CouncilWorkspace key={council.id} {...props} councils={councils} council={council} onSelect={setCouncilId} />
}

function CouncilWorkspace({ council, councils, onSelect, user, logoutBusy, onLogout, onCouncilsChanged }:
  Omit<Props, 'initialCouncilId'> & { council: MyCouncil; onSelect: (councilId: string) => void }) {
  const { state, reload } = useCouncilView(council.id)
  const team = useTeam(council.id, reload)
  const [page, setPage] = useState<Page>('people')
  // 768px 미만에서 옆 메뉴로 연 시트. 메뉴를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => { if (state.kind === 'lost') onCouncilsChanged() }, [state.kind, onCouncilsChanged])
  const view = state.kind === 'ready' ? state.view : null
  const sidebar = <WorkspaceSidebar council={council} councils={councils} view={view} page={page} user={user} logoutBusy={logoutBusy} onLogout={onLogout}
    onSelect={councilId => { setNavOpen(false); onSelect(councilId) }} onPage={next => { setNavOpen(false); setPage(next) }} />
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={council.name} section={titles[page].section} title={titles[page].title} onMenu={() => setNavOpen(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {state.kind === 'lost' ? <StateMessage kind="notice">이 학생회의 운영진이 아니게 되었어요. 학생회 목록으로 돌아가요.</StateMessage>
          : state.kind === 'failed' ? <Card className="flex flex-col gap-3 p-6">
            <StateMessage kind="error">학생회를 불러오지 못했어요. 연결을 확인해 주세요.</StateMessage>
            <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button>
          </Card>
          : !view ? <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
          : <People view={view} team={team} onCouncilChanged={reload} />}
      </main>
    </div>
  </div>
}
