import {
  MEETING_ACTIONS,
  type ErrorCode,
  type MeetingAction,
  type MeetingRelation,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, type Context } from '../access/permissions.js'

export type MeetingFacts = {
  hostDepartmentId: string | null
  createdBy: string | null
  isAttendee: boolean
  cancelledAt: Date | null
  confirmedAt: Date | null
  hasTasks: boolean
}
// 내 관계를 정하는 사실만이다. 캘린더도 회의 화면과 같은 관계를 쓴다.
type RelationFacts = Pick<MeetingFacts, 'hostDepartmentId' | 'createdBy' | 'isAttendee'>
const contextOf = (facts: RelationFacts): Context => ({
  ...(facts.hostDepartmentId ? { departmentId: facts.hostDepartmentId } : {}),
  ...(facts.createdBy ? { createdBy: facts.createdBy } : {}),
  isMeetingAttendee: facts.isAttendee,
})

export function decide(actor: Actor, facts: MeetingFacts, action: MeetingAction): ErrorCode | null {
  const permission = action === 'meeting.minutes' ? 'meeting.write' : 'meeting.manage'
  if (!can(actor, permission, contextOf(facts))) return 'FORBIDDEN'
  if (facts.cancelledAt) return 'MEETING_CANCELLED'
  if (action === 'meeting.amend') return facts.confirmedAt ? null : 'INVALID_INPUT'
  if (facts.confirmedAt) return 'RECORD_CONFIRMED'
  return action === 'meeting.cancel' && facts.hasTasks ? 'MEETING_HAS_TASKS' : null
}
export const actionsOf = (actor: Actor, facts: MeetingFacts): MeetingAction[] =>
  MEETING_ACTIONS.filter(action => decide(actor, facts, action) === null)

export function relationOf(actor: Actor, facts: RelationFacts): MeetingRelation {
  if (can(actor, 'meeting.manage', contextOf(facts))) return 'manager'
  return facts.isAttendee ? 'attendee' : 'none'
}
