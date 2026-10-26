import { createContext, useCallback, useContext, useState } from 'react'
import type { ChatMessage, RoomParticipant } from '@vada/contracts'

// 답글 패널에 연 원글과 그 방(022 조각 11). 원글은 패널이 답글과 함께 읽는다(알림으로 열면 흐름에 없을 수 있다).
// 방의 참여자(부르기)와 보기만 여부는 연 방 화면이 이미 읽은 값이다.
// onOriginal: 패널이 읽은 원글(답글 수, 마지막 답글 시각)로 연 방 흐름의 그 메시지를 바꾼다.
export type ReplyTarget = {
  roomId: string
  messageId: string
  participants: RoomParticipant[]
  // 보기만 되는 방(상대가 떠난 1:1, 완료한 행사의 방)은 답글을 읽기만 한다.
  readOnly: boolean
  // 행사 방이면 그 행사(022 조각 9). 답글에서 연 요청·상품 정보도 그 행사로 시작하고, 보관이면 '완료된 행사'를 보인다.
  eventId: string | null
  onOriginal?: ((original: ChatMessage) => void) | undefined
}

// 작업 공간이 주는 답글 열기. 열 수 없는 곳(작업 공간 밖의 부품 확인 화면·시험)에서는 null이라 '답글' 버튼이 없다.
export const ReplyOpenContext = createContext<((target: ReplyTarget) => void) | null>(null)

export const useReplyOpener = () => useContext(ReplyOpenContext)

export function useReplyPanel() {
  const [target, setTarget] = useState<ReplyTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])
  return { target, open: setTarget, close }
}
