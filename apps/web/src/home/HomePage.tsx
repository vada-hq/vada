import { useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { HOME_LOAD_FAILED } from '@/lib/messages'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import type { RoomListState } from '../chat/useRoomList'
import { NewEventDialog } from '../events/EventCreateDialog'
import { canCreateEvent } from '../events/event-view'
import HomeBody, { type HomeOpeners } from './HomeBody'
import { awaitingDepartment } from './member-view'
import { useHome } from './useHome'

// 줄을 눌러 업무·요청·행사를 그 화면에서 연다.
type Props = Omit<HomeOpeners, 'onNewEvent'> & {
  view: CouncilView
  // 홈 메시지함이 쓰는 대화 목록(작업 공간이 읽는다)
  rooms: RoomListState
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
}

// 옆 메뉴 '홈': 그 사람의 부분을 한 번 읽어 보인다. 읽기만 하고, 줄은 원래 기록의 화면으로 간다.
export default function HomePage({ view, rooms, onForbidden, ...openers }: Props) {
  const { state, reload } = useHome(view.council.id, onForbidden)
  const dialogs = useRecordDialogs()
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    setRetrying(true)
    try {
      await reload()
    } finally {
      setRetrying(false)
    }
  }
  if (state.kind === 'loading') return <StateMessage kind="loading">홈 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{HOME_LOAD_FAILED}</StateMessage>
        <Button
          variant="outline"
          className="self-start"
          busy={retrying}
          onClick={() => void retry()}
        >
          다시 불러오기
        </Button>
      </div>
    )
  return (
    <PageColumn>
      {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      <HomeBody
        home={state.home}
        councilId={view.council.id}
        name={view.me.name}
        memberId={view.me.memberId}
        awaitingDepartment={awaitingDepartment(view.me)}
        rooms={rooms}
        onForbidden={onForbidden}
        onNewEvent={canCreateEvent(view) ? dialogs.startCreate : undefined}
        {...openers}
      />
      {dialogs.creating && (
        <NewEventDialog
          view={view}
          onClose={dialogs.closeCreate}
          onLost={dialogs.lose}
          onForbidden={onForbidden}
        />
      )}
    </PageColumn>
  )
}
