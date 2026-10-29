import type { ReactNode } from 'react'
import type { CouncilTitles, TeamMember } from '@vada/contracts'
import { cn } from '@/lib/utils'
import type { DepartmentGroup } from './team-view'

type Person = (member: TeamMember, groupKey: string) => ReactNode

type ListProps = {
  label: string
  people: TeamMember[]
  groupKey: string
  person: Person
  className?: string
}

// 사람 카드 목록. 묶음 키는 겸직자의 카드가 묶음마다 있어 ⋯ 버튼을 묶음 키와 함께 가린다.
export function PersonCards({ label, people, groupKey, person, className }: ListProps) {
  return (
    <ul aria-label={label} className={cn('grid grid-cols-2 gap-2', className)}>
      {people.map(member => person(member, groupKey))}
    </ul>
  )
}

const SECTION_LABEL = 'mb-1.5 text-xs text-fg-muted'

type DepartmentProps = {
  group: DepartmentGroup
  titles: CouncilTitles
  person: Person
  // 부장이 없을 때 그 자리의 [부장 지정]. 지정할 수 없으면 null이고 '없음'이 보인다.
  headPicker: ReactNode
}

// 부서 카드 몸통(와이어프레임 ORG-03A): 부장 칸과 부원 칸. 부원은 부장 말고 그 부서 사람 모두이고 직급 순이다.
// 직급 이름은 학생회가 정한 표시 이름이다(DEC-16).
export function DepartmentPeople({ group, titles, person, headPicker }: DepartmentProps) {
  const { department, heads } = group
  const staff = group.members.filter(member => !heads.includes(member))
  return (
    <>
      <div>
        <p className={SECTION_LABEL}>{titles.head}</p>
        {heads.length > 0 ? (
          <PersonCards
            label={`${department.name} ${titles.head}`}
            people={heads}
            groupKey={department.id}
            person={person}
          />
        ) : (
          (headPicker ?? <p className="text-sm text-fg-muted">없음</p>)
        )}
      </div>
      <div>
        <p className={SECTION_LABEL}>부원 {staff.length}명</p>
        {staff.length > 0 && (
          <PersonCards
            label={`${department.name} 부원`}
            people={staff}
            groupKey={department.id}
            person={person}
          />
        )}
      </div>
    </>
  )
}
