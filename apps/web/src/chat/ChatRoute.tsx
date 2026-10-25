import { menuPath, recordPath } from '@vada/contracts'
import { leave, navigate, useHere } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import ChatPage, { type Screen } from './ChatPage'

type Props = Omit<
  Parameters<typeof ChatPage>[0],
  'screen' | 'onScreen' | 'onBack' | 'onOpenRequest'
>

// 대화의 어느 화면인지는 주소가 정한다: 방은 /chat/{학생회}/{방}, 공지 모아 보기는 대화의 ?tab=notices, 나머지는 첫 화면(목록)이다.
function screenOf(here: ReturnType<typeof useHere>, councilId: string): Screen {
  const location = here.location
  if (location?.councilId !== councilId) return { kind: 'list' }
  if (location.type === 'record')
    return location.record === 'chat'
      ? { kind: 'room', roomId: location.recordId }
      : { kind: 'list' }
  if (location.menu === 'chat' && location.query['tab'] === 'notices') return { kind: 'notices' }
  return { kind: 'list' }
}

export default function ChatRoute(props: Props) {
  const { councilId } = props
  const screen = screenOf(useHere(), councilId)
  const first = menuPath('chat', councilId)
  const open = (next: Screen) => {
    if (next.kind === 'room') navigate(recordPath('chat', councilId, next.roomId))
    else if (next.kind === 'notices') navigate(menuPath('chat', councilId, { tab: 'notices' }))
    // 목록은 '찾을 수 없음'에서 상위 목록으로 가는 길이다. 못 보는 주소를 기록에 남기지 않는다.
    else navigate(first, { replace: true })
  }
  // 뒤로는 들어온 곳이다(홈의 공지 줄에서 왔으면 홈, 방에서 왔으면 그 방). 바로 들어왔으면 대화 첫 화면이다.
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
