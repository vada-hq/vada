import {
  koreanOf,
  type CouncilRank,
  type CouncilTitles,
  type DepartmentRank,
  type TeamDepartment,
  type TeamMember,
} from '@vada/contracts'

// 직급의 표시 이름. 학생회가 정한 이름을 쓴다(DEC-16). 직급이 없으면 null이다.
export const councilRankLabel = (rank: CouncilRank | null, titles: CouncilTitles) =>
  rank === 'president' ? titles.president : rank === 'vice_president' ? titles.vicePresident : null
export const departmentRankLabel = (rank: DepartmentRank | null, titles: CouncilTitles) =>
  rank === 'head' ? titles.head : rank === 'vice_head' ? titles.viceHead : null

// 들어온 날(한국 날짜). 예: 2026.10.19
export const joinedDay = (iso: string) => koreanOf(new Date(iso)).slice(0, 10).replaceAll('-', '.')

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

// 학생회 직급이나 부서 직급이 하나라도 붙어 있는가. 서버는 이런 사람을 내보내거나 직급 있는 소속을 끝낼 때 직급 칸(rank.manage)도 본다.
export const holdsRank = (member: Pick<TeamMember, 'councilRank' | 'departments'>) =>
  member.councilRank !== null || member.departments.some(item => item.rank !== null)
