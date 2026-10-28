import { SCHEDULE_ACTIONS, type ErrorCode, type ScheduleAction } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, isLeadership } from '../access/permissions.js'

const PERMISSION_OF = {
  'schedule_item.update': 'schedule.update',
  'schedule_item.cancel': 'schedule.delete',
} as const satisfies Record<ScheduleAction, string>

type Facts = { departmentId: string | null; createdBy: string | null; cancelledAt: Date | null }

// 읽기의 동작과 쓰기의 거절은 같은 판정이다(DEC-38·102).
export function decide(actor: Actor, facts: Facts, action: ScheduleAction): ErrorCode | null {
  if (facts.cancelledAt) return 'NOT_FOUND'
  return can(actor, PERMISSION_OF[action], {
    ...(facts.departmentId ? { departmentId: facts.departmentId } : {}),
    ...(facts.createdBy ? { createdBy: facts.createdBy } : {}),
  })
    ? null
    : 'FORBIDDEN'
}

export const actionsOf = (actor: Actor, facts: Facts): ScheduleAction[] =>
  SCHEDULE_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 일정에 고를 수 있는 부서: 회장단은 모든 부서, 그 밖은 내 지금 소속 부서(DEC-102). 선택지와 쓰기 거절이 같은 판정이다.
export const departmentChoosable = (actor: Actor, departmentId: string) =>
  isLeadership(actor) || actor.departments.some(item => item.departmentId === departmentId)
