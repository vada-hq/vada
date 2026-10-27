import {
  EXPENSE_DESCRIPTION_MAX,
  koreanDateOf,
  type ChatMessage,
  type TeamMember,
} from '@vada/contracts'
import { clipText, firstLineOf } from './request-seed'

// 메시지로 지출을 열 때 채우는 값. 모두 사람이 고친다. 계좌는 지금처럼 대표 계좌가 채운다.
export type ExpenseSeed = {
  description: string
  paidOn: string
  // 비면 학생회 돈이다.
  paidBy: string | null
  sourceMessageId: string
  // 이 메시지로 만든 구매 요청들. 결제할 수 있는 것이 하나면 지출 폼이 그 요청을 골라 둔다.
  linkedRequestIds: string[]
}

type Context = {
  meId: string
  // 지금 운영진. 아직 못 읽었으면 null이다.
  members: TeamMember[] | null
}

// 남의 메시지면 보낸 사람이 먼저 낸 사람이다. 내 메시지는 학생회 돈이고, 떠났거나 시스템이면 비운다.
function payerOf(message: ChatMessage, { meId, members }: Context) {
  const sender = message.senderId
  if (sender === null || sender === meId) return null
  return members?.some(member => member.id === sender) ? sender : null
}

export function expenseSeedOf(message: ChatMessage, context: Context): ExpenseSeed {
  return {
    description: clipText(firstLineOf(message), EXPENSE_DESCRIPTION_MAX),
    paidOn: koreanDateOf(new Date(message.sentAt)),
    paidBy: payerOf(message, context),
    sourceMessageId: message.id,
    linkedRequestIds: message.made
      .filter(made => made.kind === 'purchase_request')
      .map(made => made.id),
  }
}
