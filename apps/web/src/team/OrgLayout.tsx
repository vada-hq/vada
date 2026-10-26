import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { OrgGroupCard } from './OrgGroupCard'
import { orgGroups, type DepartmentGroup } from './team-view'
import { departmentColorOf } from '@/lib/department-color'
import { cn } from '@/lib/utils'

type Props = {
  members: TeamMember[]
  departments: TeamDepartment[]
  titles: CouncilTitles
  // 회장단(member.manage)에게는 미배정 묶음이 맨 위, 다른 운영진에게는 맨 아래다(DEC-91).
  unassignedFirst: boolean
  // 사람 한 줄(key를 단 li). groupKey는 그 줄이 든 묶음이다.
  person: (member: TeamMember, groupKey: string) => ReactNode
  // 부서 머리 오른쪽의 ⋯ 메뉴. 고칠 수 없으면 null.
  departmentAction: (department: TeamDepartment) => ReactNode
  // 이름을 바꾸는 중인 부서면 머리 자리의 편집 칸, 아니면 null.
  departmentEditor: (department: TeamDepartment) => ReactNode
  // 목록 끝의 [부서 추가]. 만들 수 없으면 null.
  add: ReactNode
}

const headcount = (people: TeamMember[]) => `${people.length}명`

// 부서 머리의 작은 글: '부장 김바다, 이윤슬 · 3명'. 직급 이름은 학생회가 정한 표시 이름이다(DEC-16).
const departmentMeta = ({ members, heads }: DepartmentGroup, titles: CouncilTitles) =>
  `${titles.head} ${heads.length > 0 ? heads.map(head => head.name).join(', ') : '없음'} · ${headcount(members)}`

// 조직 화면의 배치(와이어프레임 ORG-03A): 맨 위 회장단 카드, 그 아래 부서 카드들, 끝에 [부서 추가].
// 상자와 연결선의 조직도 대신 묶은 사람 목록이고(DEC-91, 조사 R3), 넓은 화면은 같은 묶음을 카드 격자로 늘어놓는다.
// 격자는 창 폭이 아니라 본문 폭(@container)을 본다. 옆 메뉴가 있는 1024px 창의 본문은 약 736px다.
export function OrgLayout({ members, departments, titles, unassignedFirst, ...slots }: Props) {
  const groups = orgGroups(members, departments)
  const unassigned = groups.unassigned.length > 0 && (
    <OrgGroupCard
      title="미배정 구성원"
      groupKey="unassigned"
      meta={headcount(groups.unassigned)}
      people={groups.unassigned}
      person={slots.person}
    />
  )
  return (
    <div className="@container flex flex-col gap-4">
      {unassignedFirst && unassigned}
      <OrgGroupCard
        lead
        title="회장단"
        groupKey="council"
        icon={<Star aria-hidden className="size-4 shrink-0 text-yellow-500" />}
        meta={headcount(groups.council)}
        className="@2xl:mx-auto @2xl:w-1/2"
        people={groups.council}
        person={slots.person}
      />
      {departments.length === 0 && <p className="text-sm text-gray-500">부서 없음</p>}
      <div className="grid items-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {groups.departments.map(group => (
          <OrgGroupCard
            key={group.department.id}
            title={group.department.name}
            className={cn('border-l-4', departmentColorOf(group.department.id, departments).line)}
            groupKey={group.department.id}
            badge={group.department.role === 'finance' && <Badge tone="info">재정</Badge>}
            meta={departmentMeta(group, titles)}
            action={slots.departmentAction(group.department)}
            editor={slots.departmentEditor(group.department)}
            people={group.members}
            person={slots.person}
          />
        ))}
        {slots.add}
      </div>
      {!unassignedFirst && unassigned}
    </div>
  )
}
