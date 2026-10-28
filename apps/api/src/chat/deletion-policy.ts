import type { ChatMessage } from '@vada/contracts'
import type { Actor } from '../access/actor.js'

type DeletionFacts = {
  senderId: string | null
  deletedAt: Date | null
  closing: boolean
}

// 열람 범위를 확인한 메시지의 메뉴와 삭제 요청이 같은 판정을 쓴다(DEC-38·DEC-54).
// 이미 지운 것은 메뉴에서 빼되, 삭제 재요청은 새 판을 만들지 않고 성공한다(021 정한 것 17).
export function decideDeletion(actor: Actor, facts: DeletionFacts) {
  if (facts.closing) return 'COUNCIL_CLOSING'
  if (facts.senderId !== actor.memberId) return 'NOT_FOUND'
  return facts.deletedAt === null ? 'delete' : 'deleted'
}

export const deletionActionsOf = (actor: Actor, facts: DeletionFacts): ChatMessage['actions'] =>
  decideDeletion(actor, facts) === 'delete' ? ['message.delete'] : []
