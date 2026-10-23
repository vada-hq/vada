import { useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { PERMISSION_CHANGED, ROOMS_LOAD_FAILED } from '@/lib/messages'
import type { Team } from '../team/useTeam'
import DirectDialog from './DirectDialog'
import NoticePage from './NoticePage'
import RoomList from './RoomList'
import RoomView from './RoomView'
import type { RoomList as RoomListHook } from './useRoomList'

type Screen = { kind: 'list' } | { kind: 'room'; roomId: string } | { kind: 'notices' }

type Props = {
  councilId: string
  view: CouncilView
  team: Team
  rooms: RoomListHook
  // 권한이 바뀌었을 때 학생회를 다시 읽게 한다.
  onForbidden: () => void
  // 메시지에서 낸 요청을 재정 화면에서 연다.
  onOpenRequest: (requestId: string) => void
  // 알림으로 열면 방 목록 대신 이 방에서 시작한다.
  initialRoomId?: string | undefined
  onScreen: (screen: Screen) => void
}

// 방 목록과 1:1 열기. 권한을 잃으면 대화상자를 닫고 이유를 목록 위에 보인다.
function ListScreen({ councilId, view, team, rooms, onForbidden, onScreen }: Props) {
  const [directOpen, setDirectOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const canDirect = view.permissions.includes('chat.direct')
  const { state } = rooms
  if (state.kind === 'loading')
    return <StateMessage kind="loading">대화방 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <PageColumn className="gap-3">
        <StateMessage kind="error">{ROOMS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void rooms.reload()}>
          다시 시도
        </Button>
      </PageColumn>
    )
  return (
    <>
      <RoomList
        data={state.data}
        note={note}
        canDirect={canDirect}
        onOpenRoom={roomId => onScreen({ kind: 'room', roomId })}
        onOpenNotices={() => onScreen({ kind: 'notices' })}
        onDirect={() => {
          setNote(null)
          setDirectOpen(true)
        }}
      />
      <DirectDialog
        councilId={councilId}
        meId={view.me.memberId}
        team={team}
        open={directOpen && canDirect}
        onClose={() => setDirectOpen(false)}
        onOpened={roomId => {
          setDirectOpen(false)
          void rooms.reload()
          onScreen({ kind: 'room', roomId })
        }}
        onForbidden={() => {
          setDirectOpen(false)
          setNote(PERMISSION_CHANGED)
          onForbidden()
        }}
      />
    </>
  )
}

// 대화: 방 목록 → 방, 공지 모아 보기. 목록에서 시작한다.
export default function ChatPage(props: Omit<Props, 'onScreen'>) {
  const [screen, setScreen] = useState<Screen>(() =>
    props.initialRoomId ? { kind: 'room', roomId: props.initialRoomId } : { kind: 'list' },
  )
  const list = () => setScreen({ kind: 'list' })
  if (screen.kind === 'room')
    return (
      <RoomView
        key={screen.roomId}
        councilId={props.councilId}
        roomId={screen.roomId}
        meId={props.view.me.memberId}
        rooms={props.rooms}
        canMarkNotice={props.view.permissions.includes('chat.notice')}
        request={{
          canRequest: props.view.permissions.includes('purchase.request'),
          canAssign: props.view.permissions.includes('finance.manage'),
          team: props.team.data,
          onOpenRequest: props.onOpenRequest,
        }}
        onBack={list}
        onOpenNotices={() => setScreen({ kind: 'notices' })}
        onForbidden={props.onForbidden}
      />
    )
  if (screen.kind === 'notices')
    return <NoticePage councilId={props.councilId} onBack={list} onForbidden={props.onForbidden} />
  return <ListScreen {...props} onScreen={setScreen} />
}
