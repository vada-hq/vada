import { Ellipsis } from 'lucide-react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { rowActions } from './people-access'
import { councilRankLabel, joinedDay, placementsText } from './team-view'

type Actions = ReturnType<typeof rowActions>
type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  actions: Actions
  saving: boolean
  triggerRef: (element: HTMLElement | null) => void
  onAssign: () => void
  onToggleRank: () => void
  onTransfer: () => void
  onRemove: () => void
}

// 운영진 한 줄: 이름, 직급, 부서, 들어온 날, 그리고 권한에 맞는 항목이 있을 때만 ⋯ 메뉴.
export function MemberRow(props: Props) {
  const { member, departments, titles, actions } = props
  const rank = councilRankLabel(member.councilRank, titles)
  const placements = placementsText(member, departments, titles)
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">
          {member.name}
          {rank && <Badge tone="info">{rank}</Badge>}
        </p>
        <p className="text-xs wrap-anywhere text-gray-500">
          {placements || '부서 없음'} · {joinedDay(member.joinedAt)} 들어옴
        </p>
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
