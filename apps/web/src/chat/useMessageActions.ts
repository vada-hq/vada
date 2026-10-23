import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
import { Megaphone, ShoppingCart } from 'lucide-react'
import type { MessageAction } from './MessageMenu'

export type MessageActionSet = {
  // 공지 붙이기·떼기는 회장단이 전체방 메시지에서만 한다.
  canMarkNotice: boolean
  // 실패하면 보여 줄 문구를, 성공하면 null을 돌려준다.
  onMarkNotice: (message: ChatMessage, isNotice: boolean) => Promise<string | null>
  // 구매 요청 만들기는 `purchase.request`가 있을 때만 메뉴에 있다.
  canRequest: boolean
  onRequest: (message: ChatMessage) => void
}

export type MessageActionArgs = MessageActionSet & { message: ChatMessage }

// 메시지 메뉴에 들어갈 동작들과 진행 중 상태. 동작을 더할 때는 여기에서 조건을 보고 한 줄을 더한다.
export function useMessageActions({
  message,
  canMarkNotice,
  onMarkNotice,
  canRequest,
  onRequest,
}: MessageActionArgs) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toggleNotice = async () => {
    setBusy(true)
    setError(await onMarkNotice(message, !message.isNotice))
    setBusy(false)
  }
  const actions: MessageAction[] = []
  if (canRequest)
    actions.push({
      key: 'request',
      label: '구매 요청 만들기',
      icon: ShoppingCart,
      onSelect: () => onRequest(message),
    })
  if (canMarkNotice)
    actions.push({
      key: 'notice',
      label: message.isNotice ? '공지 해제' : '공지로 표시',
      icon: Megaphone,
      onSelect: () => void toggleNotice(),
    })
  // 공지 동작을 잃었으면(403 뒤 권한을 새로 읽음) 그 실패 문구는 흐름 위의 안내가 대신한다.
  return { actions, busy, error: canMarkNotice ? error : null }
}
