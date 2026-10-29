import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { OrgConnector, DEPARTMENT_COLUMN } from './OrgConnector'
import { OrgGroupCard } from './OrgGroupCard'
import { DepartmentPeople, PersonCards } from './OrgPeople'
import { orgGroups, type DepartmentGroup } from './team-view'
import { departmentColorOf } from '@/lib/department-color'
import { cn } from '@/lib/utils'

type Props = {
  members: TeamMember[]
  departments: TeamDepartment[]
  titles: CouncilTitles
  // 회장단(member.manage)에게는 미배정 묶음이 맨 위, 다른 운영진에게는 맨 아래다(DEC-91).
  unassignedFirst: boolean
  focusFinance?: boolean
  // 홈 '부장 정하기'로 열면 그 부서로 스크롤하고 초점을 옮긴다.
  focusDepartment?: string | undefined
  // 사람 카드 하나(key를 단 li). groupKey는 그 카드가 든 묶음이다.
  person: (member: TeamMember, groupKey: string) => ReactNode
  // 부서 머리 오른쪽의 ⋯ 메뉴. 고칠 수 없으면 null.
  departmentAction: (department: TeamDepartment) => ReactNode
  // 이름을 바꾸는 중인 부서면 머리 자리의 편집 칸, 아니면 null.
  departmentEditor: (department: TeamDepartment) => ReactNode
  // 부장 없는 부서의 [부장 지정]. 지정할 수 없으면 null.
  headPicker?: (department: TeamDepartment) => ReactNode
  // 회장단 카드 아래의 [구성원 초대]. 초대할 수 없으면 null.
  invite?: ReactNode
  // 목록 끝의 [부서 추가]. 만들 수 없으면 null.
  add: ReactNode
}

const headcount = (people: TeamMember[]) => `${people.length}명`

// 부서 머리의 작은 글: 인원, 부장이 없으면 '부장 없음 · 0명'. 부장 이름은 몸통의 부장 칸이 이미 보여 머리에 다시 적지 않는다.
// 직급 이름은 학생회가 정한 표시 이름이다(DEC-16).
const departmentMeta = ({ members, heads }: DepartmentGroup, titles: CouncilTitles) =>
  heads.length > 0 ? headcount(members) : `${titles.head} 없음 · ${headcount(members)}`

// 조직 화면의 배치(와이어프레임 ORG-03A 조직도): 맨 위 가운데 회장단 카드, 연결선, 그 아래 부서 카드들, 끝에 [부서 추가].
// 부서가 많으면 줄을 바꿔 가로 스크롤이 없다. 한 단(휴대폰)에서는 선 없이 회장단 카드 → 부서 카드를 세로로 쌓는다.
// 격자는 창 폭이 아니라 본문 폭(@container)을 본다. 옆 메뉴가 있는 1024px 창의 본문은 약 736px다.
export function OrgLayout({
  members,
  departments,
  titles,
  unassignedFirst,
  focusFinance,
  focusDepartment,
  ...slots
}: Props) {
  const groups = orgGroups(members, departments)
  const financeId = focusFinance ? departments.find(item => item.role === 'finance')?.id : undefined
  const revealId = focusDepartment ?? financeId
  // 부서 카드가 칸 사이 간격의 반만큼 안으로 들어가 있어 미배정 카드도 같은 선에 맞춘다.
  const unassigned = groups.unassigned.length > 0 && (
    <OrgGroupCard title="미배정 구성원" meta={headcount(groups.unassigned)} className="@2xl:mx-2">
      <PersonCards
        label="미배정 구성원 구성원"
        people={groups.unassigned}
        groupKey="unassigned"
        person={slots.person}
        className="@2xl:grid-cols-4 @4xl:grid-cols-6"
      />
    </OrgGroupCard>
  )
  return (
    <div className="@container flex flex-col gap-4">
      {unassignedFirst && unassigned}
      <div className="flex flex-col gap-4 @2xl:gap-0">
        <CouncilCard council={groups.council} person={slots.person} invite={slots.invite} />
        {departments.length > 0 && <OrgConnector total={departments.length} />}
        <div className="flex flex-wrap items-start justify-center gap-y-4">
          {groups.departments.map(group => (
            <div key={group.department.id} className={DEPARTMENT_COLUMN}>
              <OrgGroupCard
                title={group.department.name}
                // 부서 색은 업무 보드의 부서 칩과 같은 색이다. 테두리 대신 이름 앞 점으로 둔다.
                icon={
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      departmentColorOf(group.department.id, departments).dot,
                    )}
                  />
                }
                reveal={group.department.id === revealId}
                badge={group.department.role === 'finance' && <Badge tone="info">재정</Badge>}
                meta={departmentMeta(group, titles)}
                action={slots.departmentAction(group.department)}
                editor={slots.departmentEditor(group.department)}
              >
                <DepartmentPeople
                  group={group}
                  titles={titles}
                  person={slots.person}
                  headPicker={slots.headPicker?.(group.department)}
                />
              </OrgGroupCard>
            </div>
          ))}
        </div>
      </div>
      {departments.length === 0 && <p className="text-sm text-fg-muted">부서 없음</p>}
      {slots.add && <div className={cn('self-center', DEPARTMENT_COLUMN)}>{slots.add}</div>}
      {!unassignedFirst && unassigned}
    </div>
  )
}

type CouncilProps = { council: TeamMember[]; invite: ReactNode } & Pick<Props, 'person'>

// 맨 위 가운데 회장단 카드: 회장과 부회장 모두(부회장이 여럿이어도), 그 아래 [구성원 초대].
function CouncilCard({ council, person, invite }: CouncilProps) {
  return (
    <OrgGroupCard
      title="회장단"
      icon={<Star aria-hidden className="size-4 shrink-0 text-star-bright" />}
      className="w-full @2xl:mx-auto @2xl:w-fit @2xl:min-w-80"
    >
      {council.length === 0 ? (
        <p className="text-sm text-fg-muted">구성원 없음</p>
      ) : (
        <PersonCards
          label="회장단 구성원"
          people={council}
          groupKey="council"
          person={person}
          className="@2xl:flex @2xl:flex-wrap @2xl:justify-center @2xl:*:w-36"
        />
      )}
      {invite}
    </OrgGroupCard>
  )
}
