import { Ellipsis } from 'lucide-react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { rowActions } from './people-access'
import { cn } from '@/lib/utils'
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

// 직급 배지: 학생회 직급(회장은 와이어프레임 ORG-03A처럼 노랑, 부회장은 파랑)과, 부서 묶음이면 그 부서의 직급(회색).
// 부서 묶음도 회장단을 맨 앞에 놓으므로(contracts sortByRank) 왜 앞인지 보이게 학생회 직급을 함께 붙인다.
function RankBadge({
  member,
  titles,
  inDepartment,
}: Pick<Props, 'member' | 'titles' | 'inDepartment'>) {
  const council = councilRankLabel(member.councilRank, titles)
  const rank = inDepartment
    ? (member.departments.find(item => item.id === inDepartment)?.rank ?? null)
    : null
  const department = departmentRankLabel(rank, titles)
  return (
    <>
      {council && (
        <Badge tone={member.councilRank === 'president' ? 'warning' : 'info'}>{council}</Badge>
      )}
      {department && <Badge>{department}</Badge>}
    </>
  )
}

// 회장단 카드 안의 사람 카드는 와이어프레임 ORG-03A처럼 직급 배지와 같은 색 면이다. 얼굴 원도 같은 색이다.
const CARD_TINT = {
  president: 'border-warning-border bg-warning-surface',
  vice_president: 'border-primary-border bg-primary-surface',
} as const
const FACE_TINT = {
  president: 'bg-warning-surface text-warning ring-1 ring-warning-border',
  vice_president: 'bg-primary-surface text-primary-strong ring-1 ring-primary-border',
} as const

// 조직도의 사람 카드(와이어프레임 ORG-03A): 얼굴 원, 이름, 직급 배지, 다른 소속. 학부·학년은 저장하지 않아 없다.
// 부서 카드 안이면 이미 보이는 그 부서를 소속에서 뺀다(DEC-91). 카드 어디를 눌러도 ⋯ 메뉴가 열린다.
export function MemberRow(props: Props) {
  const { member, departments, titles, actions, inDepartment } = props
  const others = {
    departments: member.departments.filter(item => item.id !== inDepartment),
  }
  const placements = placementsText(others, departments, titles)
  const rank = member.councilRank
  return (
    <li
      className={cn(
        'group relative flex min-w-0 flex-col gap-1.5 rounded-md border bg-card p-3',
        !inDepartment && rank && CARD_TINT[rank],
      )}
    >
      <div className="flex min-h-8 items-start justify-between gap-1">
        <Avatar className={cn('size-8', rank && FACE_TINT[rank])} />
        {(actions.assign || actions.rank || actions.transfer) && (
          // 마우스가 있는 화면에서는 카드에 올리거나 초점이 들어올 때만 ⋯를 보여 카드마다 같은 버튼이 늘어서지 않는다(대화 메시지 메뉴와 같다).
          <div className="-mt-1.5 -mr-1.5 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 pointer-fine:has-data-[state=open]:opacity-100">
            <MemberMenu {...props} />
          </div>
        )}
      </div>
      <p className="flex min-w-0 flex-col items-start gap-1 text-sm font-semibold wrap-anywhere text-fg">
        {member.name}
        <span className="flex flex-wrap gap-1 font-normal empty:hidden">
          <RankBadge member={member} titles={titles} inDepartment={inDepartment} />
        </span>
        {placements && <span className="text-xs font-normal text-fg-muted">{placements}</span>}
      </p>
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
          // 카드 전체를 누르는 자리로 넓힌다(버튼은 하나라 화면 읽기 프로그램에는 그대로다).
          className="after:absolute after:inset-0"
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
