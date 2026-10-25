import type { HomeKind } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { headDepartmentIds, isFinanceMember, isLeadership } from '../access/permissions.js'

// 홈이 어느 부분을 줄지 가르는 계층(DEC-19). 판단은 권한표의 기준(permissions.ts)을 그대로 쓰고 화면이 다시 계산하지 않는다(DEC-38).
// council: 학생회 직급(회장단), departmentIds: 부서 직급이 있는 부서(부장·부부장), finance: 재정 역할 부서 소속.
export interface HomeLevel {
  council: boolean
  departmentIds: string[]
  finance: boolean
}

export const levelOf = (actor: Actor): HomeLevel => ({
  council: isLeadership(actor),
  departmentIds: headDepartmentIds(actor),
  finance: isFinanceMember(actor),
})

// 역할별 홈의 종류(DEC-95). 재정 역할 부서는 이름이 아니라 역할로 가르고(학생회가 이름을 바꾼다, DEC-87),
// 재정 역할 부서 소속이면 부서 직급이 있어도 재정부 홈이다(재정부장의 매일 일은 결재다).
export function homeKindOf(actor: Actor): HomeKind {
  if (isLeadership(actor)) return 'council'
  if (isFinanceMember(actor)) return 'finance'
  return headDepartmentIds(actor).length > 0 ? 'department' : 'member'
}

// 회장단이면서 재정 역할 부서 소속이면 회장단 홈에 재정 보기 전환이 있다.
export const hasFinanceView = (actor: Actor) => isLeadership(actor) && isFinanceMember(actor)
