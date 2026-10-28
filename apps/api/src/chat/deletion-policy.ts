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

type EditFacts = DeletionFacts & { body: string | null; archived: boolean; linked: boolean }

// 메뉴와 요청은 근거로 이은 원문을 같은 판정으로 보호한다(DEC-71).
export function decideEdit(actor: Actor, facts: EditFacts) {
  if (facts.closing) return 'COUNCIL_CLOSING'
  if (facts.senderId !== actor.memberId || facts.deletedAt !== null) return 'NOT_FOUND'
  if (!facts.body) return 'MESSAGE_INVALID'
  if (facts.archived) return 'ROOM_ARCHIVED'
  if (facts.linked) return 'MESSAGE_LINKED'
  return 'edit'
}

export const editActionsOf = (actor: Actor, facts: EditFacts): ChatMessage['actions'] =>
  decideEdit(actor, facts) === 'edit' ? ['message.edit'] : []
