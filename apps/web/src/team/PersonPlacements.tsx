import { ChevronDown } from 'lucide-react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { NativeSelect } from '@/components/ui/native-select'
import { canMovePlacement, type PersonActions } from './people-access'
import { addChange, moveChange, rankChange, removeChange, type Undoable } from './person-changes'
import { RankOptions, rankOf, rankValue } from './rank-select'
import { departmentRankLabel } from './team-view'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  actions: PersonActions
  saving: boolean
  onSave: (item: Undoable) => void
}

type Placement = TeamMember['departments'][number]

// 사람 상세의 부서: 부서마다 줄(이름, 부서 직급, 옮기기, 부서에서 빼기)과 [부서 더하기].
// 직급은 소속마다 붙고(DEC-16) 부부장도 고를 수 있다. 옮기기와 더하기는 아직 들지 않은 부서를 고르면 바로 저장한다.
export function PersonPlacements(props: Props) {
  const { member, departments, actions } = props
  const others = departments.filter(
    department => !member.departments.some(item => item.id === department.id),
  )
  return (
    <section aria-label="부서" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">부서</h3>
      {member.departments.length === 0 ? (
        <p className="text-sm text-gray-500">부서 없음</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {member.departments.map(placement => (
            <PlacementRow key={placement.id} {...props} placement={placement} others={others} />
          ))}
        </ul>
      )}
      {actions.place && others.length > 0 && (
        <DepartmentPicker
          label="부서 더하기"
          others={others}
          saving={props.saving}
          onPick={id => props.onSave(addChange(member, id))}
        />
      )}
    </section>
  )
}

function PlacementRow({
  member,
  departments,
  titles,
  actions,
  saving,
  onSave,
  placement,
  others,
}: Props & { placement: Placement; others: TeamDepartment[] }) {
  const name = departments.find(department => department.id === placement.id)?.name ?? ''
  const movable = canMovePlacement(actions, placement)
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-sm break-keep wrap-anywhere text-gray-800">
          {name}
        </span>
        {actions.rank ? (
          <NativeSelect
            aria-label={`${name} 부서 직급`}
            className="w-28 max-sm:min-h-11"
            value={rankValue(placement.rank)}
            // 보내는 중에는 다시 바꾸지 못한다(두 번 보내기 금지). 끝나면 받은 값으로 돌아온다.
            disabled={saving}
            onChange={event => onSave(rankChange(member, placement, rankOf(event.target.value)))}
          >
            <RankOptions titles={titles} />
          </NativeSelect>
        ) : (
          <span className="text-xs text-gray-500">
            {departmentRankLabel(placement.rank, titles) ?? '직급 없음'}
          </span>
        )}
      </div>
      {movable && (
        <div className="flex flex-wrap gap-2">
          {others.length > 0 && (
            <DepartmentPicker
              label="옮기기"
              accessibleName={`${name}에서 옮기기`}
              others={others}
              saving={saving}
              onPick={id => onSave(moveChange(member, placement, id))}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            touch
            busy={saving}
            aria-label={`${name}에서 빼기`}
            onClick={() => onSave(removeChange(member, placement))}
          >
            부서에서 빼기
          </Button>
        </div>
      )}
    </li>
  )
}

type PickerProps = {
  label: string
  accessibleName?: string
  others: TeamDepartment[]
  saving: boolean
  onPick: (departmentId: string) => void
}

// 아직 들지 않은 부서를 골라 바로 저장하는 메뉴(옮기기, 부서 더하기). 기본으로 골라 둔 부서는 없다.
function DepartmentPicker({ label, accessibleName, others, saving, onPick }: PickerProps) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          touch
          busy={saving}
          aria-label={accessibleName}
          className="self-start"
        >
          {label}
          <ChevronDown aria-hidden />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {others.map(department => (
          <MenuItem key={department.id} onSelect={() => onPick(department.id)}>
            {department.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
