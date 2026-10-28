import { menuPath, recordPath } from '@vada/contracts'
import { leave, navigate, useHere } from '@/lib/app-location'
import { openMessageRoom, openRecord } from '@/lib/go-to'
import ChatPage, { type Screen } from './ChatPage'
import { councilRooms } from './space-rooms'
import { useSplit } from '@/lib/use-split'
import { savedSideRoom } from './last-room'
import { useUnlistedDirect } from './SideChatRoute'

type Props = Omit<
  Parameters<typeof ChatPage>[0],
  'screen' | 'onScreen' | 'onBack' | 'onOpenRequest'
>

type Unlisted = ReturnType<typeof useUnlistedDirect>

function recordScreen(
  roomId: string,
  props: Props,
  mode: { split: boolean; unlisted: Unlisted },
): Screen {
  const remembered = savedSideRoom(props.councilId, props.view.me.memberId) === roomId
  const summary =
    props.rooms.state.kind === 'ready'
      ? props.rooms.state.data.rooms.find(room => room.id === roomId)
      : undefined
  // 빈 1:1은 목록에 아직 없다. 열기 API가 방금 준 방도 같은 칸에서 즉시 연다.
  if (mode.split && isDirectRecord(remembered, summary?.type, mode.unlisted))
    return { kind: 'home', sideRoomId: roomId }
  // 방 종류를 알기 전에는 첫 화면이 목록을 기다리거나 다시 시도를 보인다. 학생회 방을 전체 폭으로 잘못 열지 않는다.
  if (props.rooms.state.kind !== 'ready') return { kind: 'home', roomId }
  if (mode.split && !summary && !mode.unlisted) return { kind: 'home', roomId }
  return councilRooms(props.rooms.state.data.rooms).some(room => room.id === roomId)
    ? { kind: 'home', roomId }
    : { kind: 'room', roomId }
}

function isDirectRecord(remembered: boolean, type: string | undefined, unlisted: Unlisted) {
  return remembered || type === 'direct' || unlisted?.direct === true
}

// 옛 알림·근거 주소도 서버 방 목록의 자리로 연다. 학생회 방의 기록 주소는 탭을 가리키는 주소로 계속 쓴다.
function screenOf(
  here: ReturnType<typeof useHere>,
  props: Props,
  mode: { split: boolean; unlisted: Unlisted },
): Screen {
  const location = here.location
  if (location?.councilId !== props.councilId) return { kind: 'home' }
  if (location.type === 'record' && location.record === 'chat')
    return recordScreen(location.recordId, props, mode)
  return location.query['rooms'] === 'all' ? { kind: 'list' } : { kind: 'home' }
}

function unlistedId(here: ReturnType<typeof useHere>, props: Props): string | null {
  const location = here.location
  if (
    location?.type !== 'record' ||
    location.record !== 'chat' ||
    location.councilId !== props.councilId
  )
    return null
  if (props.rooms.state.kind !== 'ready') return null
  const id = location.recordId
  if (savedSideRoom(props.councilId, props.view.me.memberId) === id) return null
  return props.rooms.state.data.rooms.some(room => room.id === id) ? null : id
}

export default function ChatRoute(props: Props) {
  const { councilId } = props
  const here = useHere()
  const split = useSplit()
  const unlisted = useUnlistedDirect(councilId, split ? unlistedId(here, props) : null)
  const screen = screenOf(here, props, { split, unlisted })
  const first = menuPath('chat', councilId)
  const open = (next: Screen) => {
    if (next.kind === 'list') navigate(menuPath('chat', councilId, { rooms: 'all' }))
    else if (next.kind === 'home') {
      // 탭을 바꿀 때 기록을 쌓지 않아 뒤로 가면 들어온 화면으로 돌아간다.
      const roomId = next.sideRoomId ?? next.roomId
      navigate(roomId ? recordPath('chat', councilId, roomId) : first, { replace: true })
    } else {
      const eventId =
        props.rooms.state.kind === 'ready'
          ? props.rooms.state.data.rooms.find(room => room.id === next.roomId)?.eventId
          : null
      openMessageRoom(councilId, next.roomId, eventId)
    }
  }
  // 뒤로는 들어온 곳이다(홈에서 왔으면 홈, 방에서 왔으면 그 방). 바로 들어왔으면 대화 첫 화면이다.
  // '재정에서 보기'는 그 요청의 주소로 쌓아, 요청을 닫으면 그 방으로 돌아온다.
  return (
    <ChatPage
      {...props}
      screen={screen}
      onScreen={open}
      onBack={() => leave(first)}
      onOpenRequest={requestId => openRecord('purchases', councilId, requestId)}
    />
  )
}
