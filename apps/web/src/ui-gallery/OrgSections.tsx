import type { ReactNode } from 'react'
import {
  DEPARTMENT_NAME_MAX,
  MEMBER_NAME_MAX,
  type CouncilTitles,
  type TeamDepartment,
  type TeamMember,
} from '@vada/contracts'
import { DepartmentAdd } from '@/team/DepartmentAdd'
import { DepartmentMenu } from '@/team/DepartmentMenu'
import { DepartmentRename } from '@/team/DepartmentRename'
import { MemberRow } from '@/team/MemberRow'
import { OrgLayout } from '@/team/OrgLayout'
import { Section } from './GallerySection'

const noop = () => {}
const DAY_DIGITS = 2
const titles: CouncilTitles = {
  president: '회장',
  vicePresident: '부회장',
  head: '부장',
  viceHead: '부부장',
}
// 올해 날짜라 들어온 때에 연도가 붙지 않는다(해가 바뀌어도 이 화면의 모양이 같다).
const joined = (day: number) =>
  `${new Date().getFullYear()}-10-${String(day).padStart(DAY_DIGITS, '0')}T01:00:00.000Z`
const person = (
  id: string,
  name: string,
  councilRank: TeamMember['councilRank'],
  departments: TeamMember['departments'] = [],
): TeamMember => ({ id, name, councilRank, departments, joinedAt: joined(Number(id.slice(1))) })

// 부회장 둘, 두 부서에 든 사람(재정부 부장이면서 기획부원), 부장 둘인 부서, 사람 없는 부서, 미배정 둘, 상한 길이의 줄바꿈 없는 이름.
const members: TeamMember[] = [
  person('m1', '김바다', 'president'),
  person('m2', '이윤슬', 'vice_president', [{ id: 'd2', rank: null }]),
  person('m3', '박해수', 'vice_president'),
  person('m4', '최재정', null, [
    { id: 'd1', rank: 'head' },
    { id: 'd2', rank: null },
  ]),
  person('m5', '정기획', null, [{ id: 'd2', rank: 'head' }]),
  person('m6', '한기획', null, [{ id: 'd2', rank: 'head' }]),
  person('m7', '오재정', null, [{ id: 'd1', rank: 'vice_head' }]),
  person('m8', '강새내', null),
  person('m9', '가'.repeat(MEMBER_NAME_MAX), null),
]
const departments: TeamDepartment[] = [
  { id: 'd1', name: '재정부', role: 'finance', memberCount: 2 },
  { id: 'd2', name: '기획부', role: null, memberCount: 4 },
  { id: 'd3', name: '홍'.repeat(DEPARTMENT_NAME_MAX), role: null, memberCount: 0 },
]

const row = (manage: boolean) => (member: TeamMember) => (
  <MemberRow
    key={member.id}
    member={member}
    departments={departments}
    titles={titles}
    actions={{ assign: manage, rank: manage, transfer: false, remove: manage }}
    saving={false}
    triggerRef={noop}
    onAssign={noop}
    onToggleRank={noop}
    onTransfer={noop}
    onRemove={noop}
  />
)

const addProps = {
  saving: false,
  error: '',
  name: '',
  onName: noop,
  onCreate: () => Promise.resolve(false),
  onEdit: noop,
  onOpen: noop,
  onClose: noop,
}

// 회장단이 보는 조직 화면. renaming이면 기획부 머리가 제자리 이름 바꾸기, adding이면 [부서 추가]가 펼쳐져 있다.
function LeadOrg({ renaming = false, adding = false }: { renaming?: boolean; adding?: boolean }) {
  return (
    <OrgLayout
      members={members}
      departments={departments}
      titles={titles}
      unassignedFirst
      person={row(true)}
      departmentAction={department => (
        <DepartmentMenu
          department={department}
          saving={false}
          triggerRef={noop}
          onRename={noop}
          onToggleFinance={noop}
          onRemove={noop}
        />
      )}
      departmentEditor={department =>
        renaming &&
        department.id === 'd2' && (
          <DepartmentRename
            department={department}
            name="기획부"
            error=""
            saving={false}
            onName={noop}
            onSubmit={noop}
            onClose={noop}
          />
        )
      }
      add={<DepartmentAdd open={adding} {...addProps} />}
    />
  )
}

function MemberOrg() {
  return (
    <OrgLayout
      members={members}
      departments={departments}
      titles={titles}
      unassignedFirst={false}
      person={row(false)}
      departmentAction={() => null}
      departmentEditor={() => null}
      add={null}
    />
  )
}

// 실제 화면의 본문 폭: 1280px 창은 옆 메뉴(240px)와 여백을 빼 약 992px, 1024px 창은 약 736px, 휴대폰 390px 창은 약 358px다.
function Width({
  label,
  className,
  children,
}: {
  label: string
  className: string
  children: ReactNode
}) {
  return (
    <div className="flex max-w-full flex-col gap-1 overflow-x-auto">
      <p className="text-xs text-gray-400">{label}</p>
      <div className={className}>{children}</div>
    </div>
  )
}

// 조직 화면(와이어프레임 ORG-03A, DEC-91): 회장단 카드 → 부서 카드 격자 → [부서 추가]. 연결선 없이 묶은 사람 목록이다.
export function OrgSection() {
  return (
    <Section title="조직 화면">
      <Width label="1280px 창(회장단, 미배정이 맨 위)" className="w-248 shrink-0">
        <LeadOrg />
      </Width>
      <Width
        label="1024px 창(회장단, 기획부 이름 바꾸는 중, 부서 추가 펼침)"
        className="w-184 shrink-0"
      >
        <LeadOrg renaming adding />
      </Width>
      <Width label="1024px 창(부원, 미배정이 맨 아래, 동작 없음)" className="w-184 shrink-0">
        <MemberOrg />
      </Width>
      <Width label="390px 창(회장단)" className="w-89.5 shrink-0">
        <LeadOrg />
      </Width>
    </Section>
  )
}
