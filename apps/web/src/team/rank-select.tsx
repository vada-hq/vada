import type { CouncilTitles, DepartmentRank } from '@vada/contracts'

export const rankValue = (rank: DepartmentRank | null) => (rank === 'head' ? rank : '')
export const rankOf = (value: string): DepartmentRank | null => (value === 'head' ? value : null)

// 부서 직급을 고르는 칸의 선택지. 이름은 학생회가 정한 직급 이름을 쓴다.
export function RankOptions({ titles }: { titles: CouncilTitles }) {
  return (
    <>
      <option value="">부원</option>
      <option value="head">{titles.head}</option>
    </>
  )
}
