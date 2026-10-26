import type { CouncilView, TeamDepartment, TeamMember } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { MemberRow } from './MemberRow'
import { personActions } from './people-access'
import { headChange, viceChange } from './person-changes'
import { PersonPicker } from './PersonPicker'
import type { PeopleState } from './usePeople'
import type { Team } from './useTeam'

type Shared = { people: PeopleState; team: Team; view: CouncilView }

// 회장단 머리의 '{부회장} 지정'(DEC-91): 부회장이 있어도 보인다. 회장단이 아닌 사람을 골라 바로 저장하고 되돌리기를 준다.
export function councilAction({ people, team, view }: Shared) {
  const candidates = team.data?.members.filter(member => member.councilRank === null) ?? []
  if (!people.can('rank.manage') || candidates.length === 0) return null
  const title = view.council.titles.vicePresident
  return (
    <PersonPicker
      label={`${title} 지정`}
      accessibleName={`회장단에 ${title} 지정`}
      people={candidates}
      saving={team.saving}
      onPick={member => people.save(member, viceChange(member, view.council.titles))}
    />
  )
}

// 부서 머리의 '{부장} 지정'(DEC-91): 부장이 있어도 둘째를 정할 수 있고 경고가 없다. 그 부서 사람 가운데 부장이 아닌 사람을 고른다.
export function headAction({ people, team, view }: Shared, department: TeamDepartment) {
  if (!people.can('member.manage') || !people.can('rank.manage')) return null
  const candidates =
    team.data?.members.filter(member =>
      member.departments.some(item => item.id === department.id && item.rank !== 'head'),
    ) ?? []
  if (candidates.length === 0) return null
  const title = view.council.titles.head
  return (
    <PersonPicker
      label={`${title} 지정`}
      accessibleName={`${department.name} ${title} 지정`}
      people={candidates}
      saving={team.saving}
      onPick={member => {
        const placement = member.departments.find(item => item.id === department.id)
        if (placement) people.save(member, headChange(member, placement, view.council.titles))
      }}
    />
  )
}

// 사람 한 줄. 회장단이 보는 미배정 묶음의 줄에는 '부서 배정'과 '내보내기'(확인 창)가 있다(DEC-91).
export function PersonRow({
  member,
  group,
  people,
  team,
  view,
}: Shared & {
  member: TeamMember
  group: string
}) {
  const key = `${group}:${member.id}`
  const unassigned = group === 'unassigned' && people.can('member.manage')
  const removable = personActions(member, people.me, people.can).remove
  return (
    <MemberRow
      member={member}
      departments={team.data?.departments ?? []}
      titles={view.council.titles}
      inDepartment={team.data?.departments.some(item => item.id === group) ? group : null}
      onOpen={() => people.openPerson(member)}
      actions={
        unassigned && (
          <>
            <Button
              ref={people.menuFocus.triggerRef(key)}
              variant="outline"
              size="sm"
              touch
              busy={team.saving}
              aria-label={`${member.name} 부서 배정`}
              onClick={() => people.openAssign(member, key)}
            >
              부서 배정
            </Button>
            {removable && (
              <Button
                variant="outline"
                size="sm"
                touch
                busy={team.saving}
                className="text-red-700"
                aria-label={`${member.name} 내보내기`}
                onClick={() => people.askConfirm('remove', member)}
              >
                내보내기
              </Button>
            )}
          </>
        )
      }
    />
  )
}
