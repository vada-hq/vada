import type { CouncilView } from '@vada/contracts'
import ChatPage from '../chat/ChatPage'
import type { RoomList } from '../chat/useRoomList'
import CouncilSettings from '../settings/CouncilSettings'
import Departments from '../team/Departments'
import People from '../team/People'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Reading } from '@/lib/use-lost'
import type { Page } from './pages'
import type { CouncilData } from './useCouncilData'

type Props = { data: CouncilData; rooms: RoomList; page: Page }

function PageOf({
  data,
  rooms,
  page,
  view,
  reading,
}: Props & { view: CouncilView; reading: Reading }) {
  if (page === 'chat')
    return (
      <ChatPage
        councilId={view.council.id}
        view={view}
        team={data.team}
        rooms={rooms}
        onForbidden={data.reload}
      />
    )
  if (page === 'people')
    return (
      <People
        view={view}
        reading={reading}
        team={data.team}
        onCouncilChanged={data.reload}
        onOwnChange={data.reloadAfterOwnChange}
      />
    )
  if (page === 'departments') return <Departments view={view} team={data.team} />
  // 학생회 이름이 바뀌면 옆 메뉴와 학생회 고르기의 이름도 바뀌도록 내 학생회 목록을 다시 읽는다.
  return <CouncilSettings view={view} onForbidden={data.reload} onSaved={data.saved} />
}

function Body({ data, rooms, page }: Props) {
  const { state } = data
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
        <Button variant="outline" className="self-start" onClick={data.reload}>
          다시 시도
        </Button>
      </Card>
    )
  if (state.kind !== 'ready') return <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
  return <PageOf data={data} rooms={rooms} page={page} view={state.view} reading={state.reading} />
}

// 작업 공간 본문. 학생회를 불러오는 동안과 잃었을 때, 못 불러왔을 때를 보여 주고, 불러왔으면 고른 쪽을 보여 준다.
export default function WorkspaceContent(props: Props) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <Body {...props} />
    </main>
  )
}
