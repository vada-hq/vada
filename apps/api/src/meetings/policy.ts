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
const contextOf = (facts: MeetingFacts): Context => ({
  ...(facts.hostDepartmentId ? { departmentId: facts.hostDepartmentId } : {}),
  ...(facts.createdBy ? { createdBy: facts.createdBy } : {}),
  isMeetingAttendee: facts.isAttendee,
})

export function decide(actor: Actor, facts: MeetingFacts, action: MeetingAction): ErrorCode | null {
  const permission = action === 'meeting.minutes' ? 'meeting.write' : 'meeting.manage'
  if (!can(actor, permission, contextOf(facts))) return 'FORBIDDEN'
  if (facts.cancelledAt) return 'MEETING_CANCELLED'
  if (action === 'meeting.minutes') return null
  if (facts.confirmedAt) return 'RECORD_CONFIRMED'
  return action === 'meeting.cancel' && facts.hasTasks ? 'MEETING_HAS_TASKS' : null
}
export const actionsOf = (actor: Actor, facts: MeetingFacts): MeetingAction[] =>
  MEETING_ACTIONS.filter(action => decide(actor, facts, action) === null)

export function relationOf(actor: Actor, facts: MeetingFacts): MeetingRelation {
  if (can(actor, 'meeting.manage', contextOf(facts))) return 'manager'
  return facts.isAttendee ? 'attendee' : 'none'
}
