import type { CouncilTitles, DepartmentRank } from '@vada/contracts'

export const rankValue = (rank: DepartmentRank | null) => rank ?? ''
export const rankOf = (value: string): DepartmentRank | null =>
  value === 'head' || value === 'vice_head' ? value : null

// 부서 직급을 고르는 칸의 선택지. 이름은 학생회가 정한 직급 이름을 쓴다.
export function RankOptions({ titles }: { titles: CouncilTitles }) {
  return (
    <>
      <option value="">직급 없음</option>
      <option value="head">{titles.head}</option>
      <option value="vice_head">{titles.viceHead}</option>
    </>
  )
}
