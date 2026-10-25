import type { ChatMessage } from '@vada/contracts'
import { Receipt, ShoppingCart } from 'lucide-react'
import type { MessageAction } from './MessageMenu'

export type MessageActionSet = {
  // 구매 요청 만들기는 `purchase.request`가 있을 때만 메뉴에 있다.
  canRequest: boolean
  onRequest: (message: ChatMessage) => void
  // 지출 적기는 `finance.manage`가 있을 때만 메뉴에 있다.
  canWriteExpense: boolean
  onWriteExpense: (message: ChatMessage) => void
}

export type MessageActionArgs = MessageActionSet & { message: ChatMessage }

// 메시지 메뉴에 들어갈 동작들. 동작을 더할 때는 여기에서 조건을 보고 한 줄을 더한다.
export function useMessageActions({
  message,
  canRequest,
  onRequest,
  canWriteExpense,
  onWriteExpense,
}: MessageActionArgs) {
  const actions: MessageAction[] = []
  // 지운 메시지로는 아무것도 만들지 않는다(본문과 사진이 없다).
  if (message.body === null) return { actions }
  if (canRequest)
    actions.push({
      key: 'request',
      label: '구매 요청 만들기',
      icon: ShoppingCart,
      onSelect: () => onRequest(message),
    })
  if (canWriteExpense)
    actions.push({
      key: 'expense',
      label: '지출 적기',
      icon: Receipt,
      onSelect: () => onWriteExpense(message),
    })
  return { actions }
}
