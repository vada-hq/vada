import type { CouncilView } from '@vada/contracts'
import CouncilSettings from '../settings/CouncilSettings'
import Departments from '../team/Departments'
import People from '../team/People'
import type { Team } from '../team/useTeam'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Page } from './pages'
import type { CouncilViewState } from './useCouncilView'

type Props = {
  state: CouncilViewState
  page: Page
  team: Team
  reload: () => void
  onSaved: (view: CouncilView) => void
}

function PageOf({
  view,
  page,
  team,
  reload,
  onSaved,
}: Omit<Props, 'state'> & { view: CouncilView }) {
  if (page === 'people') return <People view={view} team={team} onCouncilChanged={reload} />
  if (page === 'departments') return <Departments view={view} team={team} />
  // 학생회 이름이 바뀌면 옆 메뉴와 학생회 고르기의 이름도 바뀌도록 내 학생회 목록을 다시 읽는다.
  return <CouncilSettings view={view} onForbidden={reload} onSaved={onSaved} />
}

function Body({ state, page, team, reload, onSaved }: Props) {
  if (state.kind === 'lost')
    return (
      <StateMessage kind="notice">
        이 학생회의 운영진이 아니게 되었어요. 학생회 목록으로 돌아가요.
      </StateMessage>
    )
  if (state.kind === 'failed')
    return (
      <Card className="flex flex-col gap-3 p-6">
        <StateMessage kind="error">학생회를 불러오지 못했어요. 연결을 확인해 주세요.</StateMessage>
        <Button variant="outline" className="self-start" onClick={reload}>
          다시 시도
        </Button>
      </Card>
    )
  if (state.kind !== 'ready') return <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
  return <PageOf view={state.view} page={page} team={team} reload={reload} onSaved={onSaved} />
}

// 작업 공간 본문. 학생회를 불러오는 동안과 잃었을 때, 못 불러왔을 때를 보여 주고, 불러왔으면 고른 쪽을 보여 준다.
export default function WorkspaceContent(props: Props) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <Body {...props} />
    </main>
  )
}
