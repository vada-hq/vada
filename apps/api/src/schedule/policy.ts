import { SCHEDULE_ACTIONS, type ErrorCode, type ScheduleAction } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'

type Facts = { departmentId: string | null; createdBy: string | null; cancelledAt: Date | null }

// 읽기의 동작과 쓰기의 거절은 같은 판정이다(DEC-38·102).
export function decide(actor: Actor, facts: Facts, action: ScheduleAction): ErrorCode | null {
  if (facts.cancelledAt) return 'NOT_FOUND'
  return can(actor, action, {
    ...(facts.departmentId ? { departmentId: facts.departmentId } : {}),
    ...(facts.createdBy ? { createdBy: facts.createdBy } : {}),
  })
    ? null
    : 'FORBIDDEN'
}

export const actionsOf = (actor: Actor, facts: Facts): ScheduleAction[] =>
  SCHEDULE_ACTIONS.filter(action => decide(actor, facts, action) === null)
