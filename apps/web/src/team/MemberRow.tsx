import { Ellipsis } from 'lucide-react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { rowActions } from './people-access'
import { councilRankLabel, departmentRankLabel, placementsText } from './team-view'

type Actions = ReturnType<typeof rowActions>
type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  // 부서 묶음 안의 줄이면 그 부서. 직급은 그 부서의 것을 배지로 보이고 둘째 줄에서 그 부서는 뺀다.
  inDepartment?: string | null | undefined
  actions: Actions
  saving: boolean
  triggerRef: (element: HTMLElement | null) => void
  onAssign: () => void
  onToggleRank: () => void
  onTransfer: () => void
  onRemove: () => void
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

// 부서 묶음의 줄은 이미 보이는 그 부서를 소속에서 뺀다(DEC-91).
export function MemberRow(props: Props) {
  const { member, departments, titles, actions, inDepartment } = props
  const others = {
    departments: member.departments.filter(item => item.id !== inDepartment),
  }
  const placements = placementsText(others, departments, titles)
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">
          {member.name}
          <RankBadge member={member} titles={titles} inDepartment={inDepartment} />
        </p>
        {placements && <p className="text-xs wrap-anywhere text-gray-500">{placements}</p>}
      </div>
      {(actions.assign || actions.rank || actions.transfer) && <MemberMenu {...props} />}
    </li>
  )
}

function MemberMenu({ member, titles, actions, saving, triggerRef, ...on }: Props) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label={`${member.name} 동작`}
          busy={saving}
        >
          <Ellipsis />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {actions.assign && <MenuItem onSelect={on.onAssign}>부서 배정</MenuItem>}
        {actions.rank && (
          <MenuItem onSelect={on.onToggleRank}>
            {member.councilRank === 'vice_president'
              ? `${titles.vicePresident} 직급 거두기`
              : `${titles.vicePresident} 직급 주기`}
          </MenuItem>
        )}
        {actions.transfer && (
          <MenuItem onSelect={on.onTransfer}>{titles.president} 넘기기</MenuItem>
        )}
        {actions.remove && (
          <MenuItem destructive onSelect={on.onRemove}>
            내보내기
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  )
}
