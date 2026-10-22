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
