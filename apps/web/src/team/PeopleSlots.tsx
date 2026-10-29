import type { CouncilView, TeamDepartment, TeamMember } from '@vada/contracts'
import { HeadPicker } from './HeadPicker'
import { MemberRow } from './MemberRow'
import { rowActions } from './people-access'
import type { PeopleState } from './usePeople'
import type { Team } from './useTeam'

type Context = { people: PeopleState; team: Team; view: CouncilView }

// 조직도의 사람 쪽 자리: 사람 카드와 부장 없는 부서의 [부장 지정]. 둘 다 사람 카드 ⋯의 '부서 배정' 창으로 잇는다.
export function peopleSlots({ people, team, view }: Context) {
  const members = team.data?.members ?? []
  return {
    person: (member: TeamMember, group: string) => (
      <PersonCard key={member.id} member={member} group={group} {...{ people, team, view }} />
    ),
    // 고를 사람은 서버가 부서 배정을 허락한 사람이고, 그 부서 사람이 앞이다.
    headPicker: (department: TeamDepartment) => {
      const key = `head:${department.id}`
      const assignable = members.filter(member => rowActions(member, people.can).assign)
      const inside = (member: TeamMember) =>
        member.departments.some(item => item.id === department.id)
      return (
        <HeadPicker
          departmentName={department.name}
          headTitle={view.council.titles.head}
          candidates={[...assignable.filter(inside), ...assignable.filter(m => !inside(m))]}
          saving={team.saving}
          triggerRef={people.menuFocus.triggerRef(key)}
          // 부장을 정하면 [부장 지정]이 사라지므로 초점은 부장 칸의 그 사람 카드로 돌아간다.
          onPick={member => people.openAssign(member, [key, `${department.id}:${member.id}`])}
        />
      )
    },
  }
}

type CardProps = Context & {
  member: TeamMember
  // 카드가 든 묶음. 겸직자는 묶음마다 카드가 있어 닫은 뒤 초점을 연 묶음의 카드로 돌려준다.
  group: string
}

function PersonCard({ member, group, people, team, view }: CardProps) {
  const key = `${group}:${member.id}`
  return (
    <MemberRow
      member={member}
      departments={team.data?.departments ?? []}
      titles={view.council.titles}
      inDepartment={team.data?.departments.some(item => item.id === group) ? group : null}
      actions={rowActions(member, people.can)}
      saving={team.saving}
      triggerRef={people.menuFocus.triggerRef(key)}
      onAssign={() => people.openAssign(member, key)}
      // '{부회장} 해제'는 그 카드가 회장단 묶음에서 빠져 초점이 body로 떨어진다. 조각 5(묶음 머리의 부회장 지정)에서 고친다.
      onToggleRank={() => people.toggleViceRank(member)}
      onTransfer={() => people.askConfirm('transfer', member, key)}
      onRemove={() => people.askConfirm('remove', member, key)}
    />
  )
}
