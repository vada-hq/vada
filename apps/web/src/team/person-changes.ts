import type { CouncilTitles, DepartmentRank, TeamMember } from '@vada/contracts'
import { memberPath } from './usePeopleRequests'

// 편성 요청 하나(경로와 본문).
export type TeamChange = { path: string; body: unknown }
// 확인 창 없이 저장하는 바꾸기와 그것을 되돌리는 요청, 토스트 글(기능 023 정한 것 5).
// 되돌리기는 같은 편성 API로 이전 상태를 보낸다: 옮기기 → 반대로 옮기기와 옛 직급, 빼기 → 옛 직급으로 배정, 배정 → 빼기,
// 직급 → 옛 직급, 부회장 지정·해제 → 반대.
export type Undoable = { change: TeamChange; undo: TeamChange; text: string }
type Placement = TeamMember['departments'][number]

const departmentsPath = (member: TeamMember) => `${memberPath(member)}/departments`
const assign = (member: TeamMember, departmentId: string, rank: DepartmentRank | null) => ({
  path: departmentsPath(member),
  body: { departmentId, rank },
})
const remove = (member: TeamMember, departmentId: string) => ({
  path: `${departmentsPath(member)}/${encodeURIComponent(departmentId)}/remove`,
  body: {},
})
const move = (member: TeamMember, from: string, to: string, rank: DepartmentRank | null) => ({
  path: `${departmentsPath(member)}/move`,
  body: { fromDepartmentId: from, toDepartmentId: to, rank },
})

// 옮기면 옛 부서의 직급은 따라가지 않는다(DEC-91). 되돌리면 옛 부서와 옛 직급으로 돌아온다.
export const moveChange = (member: TeamMember, from: Placement, to: string): Undoable => ({
  change: move(member, from.id, to, null),
  undo: move(member, to, from.id, from.rank),
  text: `${member.name} 옮기기 완료`,
})

export const removeChange = (member: TeamMember, placement: Placement): Undoable => ({
  change: remove(member, placement.id),
  undo: assign(member, placement.id, placement.rank),
  text: `${member.name} 부서에서 빼기 완료`,
})

export const addChange = (member: TeamMember, departmentId: string): Undoable => ({
  change: assign(member, departmentId, null),
  undo: remove(member, departmentId),
  text: `${member.name} 부서 더하기 완료`,
})

export const rankChange = (
  member: TeamMember,
  placement: Placement,
  rank: DepartmentRank | null,
): Undoable => ({
  change: assign(member, placement.id, rank),
  undo: assign(member, placement.id, placement.rank),
  text: `${member.name} 직급 바꾸기 완료`,
})

// 부서 머리의 '{부장} 지정'. 부장이 있어도 둘째를 정할 수 있다(DEC-91).
export const headChange = (
  member: TeamMember,
  placement: Placement,
  titles: CouncilTitles,
): Undoable => ({
  ...rankChange(member, placement, 'head'),
  text: `${member.name} ${titles.head} 지정 완료`,
})

export function viceChange(member: TeamMember, titles: CouncilTitles): Undoable {
  const giving = member.councilRank !== 'vice_president'
  const rank = (value: 'vice_president' | null) => ({
    path: `${memberPath(member)}/rank`,
    body: { rank: value },
  })
  return {
    change: rank(giving ? 'vice_president' : null),
    undo: rank(giving ? null : 'vice_president'),
    text: `${member.name} ${titles.vicePresident} ${giving ? '지정' : '해제'} 완료`,
  }
}
