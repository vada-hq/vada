import type { ReactNode } from 'react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dayTimeLabel } from '@/lib/korean-date-text'
import { councilRankLabel, departmentRankLabel, placementsText } from './team-view'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  // 부서 묶음 안의 줄이면 그 부서. 직급은 그 부서의 것을 배지로 보이고 둘째 줄에서 그 부서는 뺀다.
  inDepartment?: string | null | undefined
  // 줄 오른쪽의 동작(미배정 묶음의 '부서 배정'·'내보내기'). 없으면 줄 전체가 상세를 여는 버튼이다.
  actions?: ReactNode
  onOpen: () => void
}

// 직급 배지: 부서 묶음에서는 그 부서의 직급(회색), 그 밖에서는 학생회 직급(회장은 와이어프레임 ORG-03A처럼 노랑, 부회장은 파랑).
function RankBadge({
  member,
  titles,
  inDepartment,
}: Pick<Props, 'member' | 'titles' | 'inDepartment'>) {
  if (inDepartment) {
    const rank = member.departments.find(item => item.id === inDepartment)?.rank ?? null
    const label = departmentRankLabel(rank, titles)
    return label && <Badge>{label}</Badge>
  }
  const label = councilRankLabel(member.councilRank, titles)
  return (
    label && <Badge tone={member.councilRank === 'president' ? 'warning' : 'info'}>{label}</Badge>
  )
}

// 운영진 한 줄: 이름, 직급, 부서, 들어온 때(DEC-47: 회장단은 들어온 순서와 시각을 본다). 누르면 사람 상세가 열린다(DEC-91).
// 둘째 줄의 소속은 그 줄이 든 부서 묶음을 빼고 적고, 남는 소속이 없으면 들어온 때만 둔다.
export function MemberRow({ member, departments, titles, inDepartment, actions, onOpen }: Props) {
  const others = {
    departments: member.departments.filter(item => item.id !== inDepartment),
  }
  const placements = placementsText(others, departments, titles)
  return (
    <li className="flex items-center">
      <Button
        variant="ghost"
        aria-haspopup="dialog"
        className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-4 py-3 text-left font-normal whitespace-normal text-gray-900 max-sm:min-h-11"
        onClick={onOpen}
      >
        <Avatar />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">
            {member.name}
            <RankBadge member={member} titles={titles} inDepartment={inDepartment} />
          </span>
          <span className="text-xs wrap-anywhere text-gray-500">
            {placements && `${placements} · `}
            {/* 들어온 때는 낱말 가운데서 끊기지 않게 통째로 줄을 바꾼다. */}
            <span className="whitespace-nowrap">{dayTimeLabel(member.joinedAt)} 들어옴</span>
          </span>
        </span>
      </Button>
      {actions && <div className="flex shrink-0 flex-wrap justify-end gap-2 pr-3">{actions}</div>}
    </li>
  )
}
