import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ROOMS_LOAD_FAILED } from '@/lib/messages'
import { Room, type RoomPage } from './ChatPage'
import type { RoomSource } from './useRoomList'

type Props = {
  // 대화 목록(page.rooms)과 권한·운영진. 읽음·보내기 뒤 대화 목록도 다시 읽어 옆 메뉴 배지를 맞춘다.
  page: RoomPage
  // 이 공간의 방들(행사면 그 행사의 공지방과 내 부서방)
  source: RoomSource
  // 열 방(방 전환이 고른 방, 처음이면 firstRoomOf). 방이 없으면 null이다.
  roomId: string | null
}

// 공간 메시지 탭의 방 화면(022 정한 것 28, DEC-96). 공간을 모르고 방 목록과 열 방만 받아, 우리 학생회 메시지 탭(028)도 같이 쓴다.
// 방 화면은 대화 화면의 방 그대로다(말풍선, 입력칸, '…' 구매 요청). 이름은 방 전환이 보여 제목 줄이 없다.
// 높이를 정해 메시지 흐름만 스크롤하고 입력칸은 아래에 붙는다.
export default function SpaceMessages({ page, source, roomId }: Props) {
  const { state } = source
  if (state.kind === 'loading')
    return <StateMessage kind="loading">대화방 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{ROOMS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void source.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (roomId === null) return <StateMessage kind="empty">대화방 없음</StateMessage>
  const rooms: RoomSource = {
    state,
    reload: async () => {
      const [own] = await Promise.all([source.reload(), page.rooms.reload()])
      return own
    },
  }
  return (
    <div className="flex h-160 max-h-svh flex-col">
      <Room key={roomId} page={page} roomId={roomId} space={rooms} />
    </div>
  )
}
