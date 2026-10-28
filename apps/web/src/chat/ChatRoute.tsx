import { menuPath, recordPath } from '@vada/contracts'
import { leave, navigate, useHere } from '@/lib/app-location'
import { openMessageRoom, openRecord } from '@/lib/go-to'
import ChatPage, { type Screen } from './ChatPage'
import { councilRooms } from './space-rooms'

type Props = Omit<
  Parameters<typeof ChatPage>[0],
  'screen' | 'onScreen' | 'onBack' | 'onOpenRequest'
>

// 옛 알림·근거 주소도 서버 방 목록의 자리로 연다. 학생회 방의 기록 주소는 탭을 가리키는 주소로 계속 쓴다.
function screenOf(here: ReturnType<typeof useHere>, props: Props): Screen {
  const location = here.location
  if (location?.councilId !== props.councilId) return { kind: 'home' }
  if (location.type === 'record' && location.record === 'chat') {
    const rooms = props.rooms.state.kind === 'ready' ? props.rooms.state.data.rooms : []
    const roomId = location.recordId
    return councilRooms(rooms).some(room => room.id === roomId)
      ? { kind: 'home', roomId }
      : { kind: 'room', roomId }
  }
  return location.query['rooms'] === 'all' ? { kind: 'list' } : { kind: 'home' }
}

export default function ChatRoute(props: Props) {
  const { councilId } = props
  const screen = screenOf(useHere(), props)
  const first = menuPath('chat', councilId)
  const open = (next: Screen) => {
    if (next.kind === 'list') navigate(menuPath('chat', councilId, { rooms: 'all' }))
    else if (next.kind === 'home') {
      // 탭을 바꿀 때 기록을 쌓지 않아 뒤로 가면 들어온 화면으로 돌아간다.
      navigate(next.roomId ? recordPath('chat', councilId, next.roomId) : first, { replace: true })
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
