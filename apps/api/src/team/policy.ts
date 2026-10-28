import {
  MEMBER_ACTIONS,
  PLACEMENT_ACTIONS,
  type CouncilRank,
  type DepartmentRank,
  type ErrorCode,
  type MemberAction,
  type PlacementAction,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'

// 운영진 정책(tasks/policy.ts 꼴): 운영진 줄마다 화면에 주는 동작(actions)과 서버의 거절이 같은 decide에서 나온다(DEC-38).
// 읽기는 teamOf → actionsOf, 쓰기는 대상 소속을 읽은 거래에서 같은 decide → 던짐이다.

// 판정에 드는 대상의 사실: 누구이고, 학생회 직급과 지금 부서 직급들이 무엇인가.
export type MemberFacts = {
  memberId: string
  councilRank: CouncilRank | null
  departmentRanks: readonly (DepartmentRank | null)[]
}

// 대상의 소속 줄과 지금 부서 소속들에서 사실을 만든다. 읽기(teamOf)와 쓰기(service.ts)가 같이 쓴다.
export const factsOf = (
  memberId: string,
  target: { councilRank: CouncilRank | null },
  placements: readonly { rank: DepartmentRank | null }[],
): MemberFacts => ({
  memberId,
  councilRank: target.councilRank,
  departmentRanks: placements.map(item => item.rank),
})

// 학생회 직급이나 부서 직급이 하나라도 붙어 있으면, 그 소속을 끝내는 일은 직급을 거두는 일이기도 하다(최소 권한, DEC-28).
const holdsRank = (facts: MemberFacts) =>
  facts.councilRank !== null || facts.departmentRanks.some(rank => rank !== null)

// 내보내기: 회장은 넘긴 뒤에만(DEC-47), 스스로는 없다, 직급이 붙어 있으면 직급 칸도 본다.
function decideRemove(actor: Actor, facts: MemberFacts): ErrorCode | null {
  if (!can(actor, 'member.manage')) return 'FORBIDDEN'
  if (facts.councilRank === 'president') return 'PRESIDENT_CANNOT_LEAVE'
  if (facts.memberId === actor.memberId) return 'CANNOT_REMOVE_SELF'
  return holdsRank(facts) && !can(actor, 'rank.manage') ? 'FORBIDDEN' : null
}

// 허용이면 null, 막으면 그 쓰기가 내는 코드.
export function decide(actor: Actor, facts: MemberFacts, action: MemberAction): ErrorCode | null {
  switch (action) {
    case 'member.assign_department':
      return can(actor, 'member.manage') ? null : 'FORBIDDEN'
    // 회장의 직급은 넘기기로만 바뀐다. 바꾸면 회장이 없어져 기록 모듈도 같은 코드로 막는다.
    case 'member.change_rank':
      if (!can(actor, 'rank.manage')) return 'FORBIDDEN'
      return facts.councilRank === 'president' ? 'PRESIDENT_REQUIRED' : null
    case 'member.hand_over_president':
      if (!can(actor, 'president.transfer')) return 'FORBIDDEN'
      return facts.memberId === actor.memberId ? 'ALREADY_PRESIDENT' : null
    case 'member.remove':
      return decideRemove(actor, facts)
  }
}

// 화면에 줄 동작: decide가 허용하는 것
export const actionsOf = (actor: Actor, facts: MemberFacts): MemberAction[] =>
  MEMBER_ACTIONS.filter(action => decide(actor, facts, action) === null)

// 부서 소속 하나의 동작. 직급이 붙은 소속을 끝내는 것은 직급을 거두는 일이기도 해서 직급 칸도 본다.
export function decidePlacement(
  actor: Actor,
  rank: DepartmentRank | null,
  action: PlacementAction,
): ErrorCode | null {
  switch (action) {
    case 'placement.remove':
      if (!can(actor, 'member.manage')) return 'FORBIDDEN'
      return rank !== null && !can(actor, 'rank.manage') ? 'FORBIDDEN' : null
  }
}

export const placementActionsOf = (actor: Actor, rank: DepartmentRank | null): PlacementAction[] =>
  PLACEMENT_ACTIONS.filter(action => decidePlacement(actor, rank, action) === null)
