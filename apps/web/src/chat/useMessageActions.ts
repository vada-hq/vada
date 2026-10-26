import type { ChatMessage, MadeRecord } from '@vada/contracts'
import { Receipt, ShoppingCart } from 'lucide-react'
import { openRecord } from '@/lib/go-to'
import type { MessageAction } from './MessageMenu'

// 이 메시지로 같은 종류의 새 기록을 막는 기록(서버가 정한 blocking, 022 정한 것 23). 없으면 만들 수 있다.
export const blockingOf = (message: ChatMessage, kind: MadeRecord['kind']) =>
  message.made.find(made => made.kind === kind && made.blocking)

export type MessageActionSet = {
  // 구매 요청 만들기는 `purchase.request`가 있을 때만 메뉴에 있다.
  canRequest: boolean
  onRequest: (message: ChatMessage) => void
  // 지출 적기는 `finance.manage`가 있을 때만 메뉴에 있다.
  canWriteExpense: boolean
  onWriteExpense: (message: ChatMessage) => void
  // 상품 정보 패널에서 낸 요청을 그 메시지 아래 기록에 바로 더한다. 방 흐름 밖(부품 확인 화면)에서는 없다.
  onMade?: ((messageId: string, made: MadeRecord) => void) | undefined
}

export type MessageActionArgs = MessageActionSet & { message: ChatMessage }

// 막힌 동작 대신 그 기록을 보는 메뉴 줄(022 정한 것 23). 만들 권한이 있는 사람에게만 만들기 자리에 둔다.
const viewAction = (councilId: string, made: MadeRecord): MessageAction =>
  made.kind === 'purchase_request'
    ? {
        key: 'request',
        label: '구매 요청 보기',
        icon: ShoppingCart,
        onSelect: () => openRecord('purchases', councilId, made.id),
      }
    : {
        key: 'expense',
        label: '지출 보기',
        icon: Receipt,
        onSelect: () => openRecord('expenses', councilId, made.id),
      }

// 메시지 메뉴에 들어갈 동작들. 동작을 더할 때는 여기에서 조건을 보고 한 줄을 더한다.
export function useMessageActions({
  councilId,
  message,
  canRequest,
  onRequest,
  canWriteExpense,
  onWriteExpense,
}: MessageActionArgs & { councilId: string }) {
  const actions: MessageAction[] = []
  // 지운 메시지로는 아무것도 만들지 않는다(본문과 사진이 없다).
  if (message.body === null) return { actions }
  const request = blockingOf(message, 'purchase_request')
  const expense = blockingOf(message, 'expense')
  if (canRequest && request) actions.push(viewAction(councilId, request))
  else if (canRequest)
    actions.push({
      key: 'request',
      label: '구매 요청 만들기',
      icon: ShoppingCart,
      onSelect: () => onRequest(message),
    })
  if (canWriteExpense && expense) actions.push(viewAction(councilId, expense))
  else if (canWriteExpense)
    actions.push({
      key: 'expense',
      label: '지출 적기',
      icon: Receipt,
      onSelect: () => onWriteExpense(message),
    })
  return { actions }
}
