import {
  type CouncilRank,
  type CouncilTitles,
  type CouncilView,
  type DepartmentRank,
  type TeamDepartment,
  type TeamMember,
} from '@vada/contracts'

// 직급의 표시 이름. 학생회가 정한 이름을 쓴다(DEC-16). 직급이 없으면 null이다.
export const councilRankLabel = (rank: CouncilRank | null, titles: CouncilTitles) =>
  rank === 'president' ? titles.president : rank === 'vice_president' ? titles.vicePresident : null
export const departmentRankLabel = (rank: DepartmentRank | null, titles: CouncilTitles) =>
  rank === 'head' ? titles.head : rank === 'vice_head' ? titles.viceHead : null

// 운영진 한 줄의 부서 글. 예: '재정부 부장 · 기획부'. 부서가 없으면 빈 글이다.
export function placementsText(
  member: Pick<TeamMember, 'departments'>,
  departments: Pick<TeamDepartment, 'id' | 'name'>[],
  titles: CouncilTitles,
) {
  return member.departments
    .map(item => {
      const name = departments.find(department => department.id === item.id)?.name ?? ''
      const rank = departmentRankLabel(item.rank, titles)
      return rank ? `${name} ${rank}` : name
    })
    .join(' · ')
}

// 옆 메뉴 발의 둘째 줄(와이어프레임 '{부서} · {직급}', DEC-96): 부서 이름을 가운뎃점으로 잇고 직급 하나를 붙인다.
// 직급은 학생회 직급이 있으면 그것, 없으면 든 부서 가운데 높은 부서 직급이다. 부서가 없으면 직급만, 둘 다 없으면 null이다.
export function sidebarRoleLine(
  me: Pick<CouncilView['me'], 'councilRank' | 'departments'>,
  titles: CouncilTitles,
) {
  const ranks = me.departments.map(item => item.rank)
  const departmentRank = ranks.includes('head')
    ? 'head'
    : ranks.includes('vice_head')
      ? 'vice_head'
      : null
  const rank =
    councilRankLabel(me.councilRank, titles) ?? departmentRankLabel(departmentRank, titles)
  const parts = [...me.departments.map(item => item.name), ...(rank ? [rank] : [])]
  return parts.length > 0 ? parts.join(' · ') : null
}

// 학생회 직급이나 부서 직급이 하나라도 붙어 있는가. 서버는 이런 사람을 내보내거나 직급 있는 소속을 끝낼 때 직급 칸(rank.manage)도 본다.
export const holdsRank = (member: Pick<TeamMember, 'councilRank' | 'departments'>) =>
  member.councilRank !== null || member.departments.some(item => item.rank !== null)

export type DepartmentGroup = {
  department: TeamDepartment
  members: TeamMember[]
  heads: TeamMember[]
}

const placedIn = (member: TeamMember, departmentId: string) =>
  member.departments.some(item => item.id === departmentId)

const headOf = (member: TeamMember, departmentId: string) =>
  member.departments.some(item => item.id === departmentId && item.rank === 'head')

// 조직 화면의 묶음(DEC-91, 기능 023 정한 것 2): 회장단(회장과 부회장 모두), 부서마다 그 부서 사람과 부장들, 미배정.
// 겸직자는 든 묶음마다 나오고, 묶음 안 차례는 서버가 준 차례(들어온 순서, DEC-47)다.
// 목록에 없는 부서에만 든 사람도 미배정에 넣어, 어느 묶음에도 없어 화면에서 사라지지 않게 한다.
export function orgGroups(members: TeamMember[], departments: TeamDepartment[]) {
  const listed = new Set(departments.map(department => department.id))
  return {
    council: members.filter(member => member.councilRank !== null),
    departments: departments.map((department): DepartmentGroup => {
      const people = members.filter(member => placedIn(member, department.id))
      return { department, members: people, heads: people.filter(m => headOf(m, department.id)) }
    }),
    unassigned: members.filter(
      member =>
        member.councilRank === null && !member.departments.some(item => listed.has(item.id)),
    ),
  }
}
