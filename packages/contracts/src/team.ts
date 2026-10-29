import { z } from 'zod'
import { isUuid, text, token, UUID_LENGTH } from './input.js'
import type { DepartmentColorKey } from './department-colors.js'
import {
  COUNCIL_RANKS,
  DEPARTMENT_RANKS,
  DEPARTMENT_ROLES,
  type CouncilRank,
  type DepartmentRank,
  type DepartmentRole,
} from './permissions.js'

// 본문으로 받는 기록 번호(부서, 넘겨받을 운영진). uuid가 아니면 400이다. 소문자로 맞춘다.
export const recordIdInput = token(UUID_LENGTH)
  .refine(isUuid)
  .transform(value => value.toLowerCase())

// 탈퇴한 운영진의 표시 이름 앞부분('떠난 운영진 N', DEC-54). 서버가 이름을 만들고 화면은 이것으로 탈퇴한 사람을 안다.
export const LEFT_MEMBER_NAME_PREFIX = '떠난 운영진 '
export const isLeftMemberName = (name: string) => name.startsWith(LEFT_MEMBER_NAME_PREFIX)

// 운영진 줄마다 서버가 주는 할 수 있는 동작. 이름은 권한 키와 떼어 둔다(기능 012 원칙). 서버 team/policy.ts가 권한표와 대상의
// 직급·본인 여부로 정하고 쓰기도 같은 판정으로 거절한다. 화면은 이것으로 메뉴를 보이거나 숨기고 다시 계산하지 않는다(DEC-38).
export const MEMBER_ACTIONS = [
  'member.assign_department',
  'member.change_rank',
  'member.hand_over_president',
  'member.remove',
] as const
export type MemberAction = (typeof MEMBER_ACTIONS)[number]
// 부서 소속 하나의 동작: 그 부서에서 빼기(직급이 붙었으면 직급 칸도 본다).
export const PLACEMENT_ACTIONS = ['placement.remove'] as const
export type PlacementAction = (typeof PLACEMENT_ACTIONS)[number]

// 운영진 목록의 한 줄. 들어온 순서와 시각을 보인다(DEC-47). 이메일은 보이지 않는다(바탕 spec G12).
export interface TeamMember {
  id: string
  name: string
  councilRank: CouncilRank | null
  departments: { id: string; rank: DepartmentRank | null; actions: PlacementAction[] }[]
  // 읽는 사람이 이 줄에 할 수 있는 동작(서버가 정한다).
  actions: MemberAction[]
  // 지금 소속을 연 시각(ISO). 다시 들어오면 다시 들어온 시각이다.
  joinedAt: string
}
export interface TeamDepartment {
  id: string
  name: string
  role: DepartmentRole | null
  memberCount: number
  // 이전 응답/견본에 없으면 식별자의 기본색을 쓴다. 서버는 표시색을 항상 준다.
  color?: DepartmentColorKey | null
}
// 조직 화면 묶음 안의 차례에 쓰는 직급 높낮이: 회장, 부회장, 그 부서의 부장, 부부장, 직급 없음(맨 뒤).
// 차례는 COUNCIL_RANKS·DEPARTMENT_RANKS에 적힌 차례 그대로이고 학생회 직급을 부서 직급보다 앞에 둔다.
// 부서 묶음에서도 회장단이 그 부서 부장보다 앞이다(사용자 요청 2026-10-29). 보이는 차례일 뿐 권한과는 상관없다(DEC-38).
const rankOrderOf = (member: TeamMember, departmentId: string | null) => {
  if (member.councilRank !== null) return COUNCIL_RANKS.indexOf(member.councilRank)
  const rank = member.departments.find(item => item.id === departmentId)?.rank ?? null
  return COUNCIL_RANKS.length + (rank === null ? DEPARTMENT_RANKS.length : DEPARTMENT_RANKS.indexOf(rank))
}
const nameOrder = new Intl.Collator('ko')
const idOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// 묶음 하나의 사람을 직급 순으로 놓은 새 목록. departmentId는 부서 묶음이면 그 부서, 회장단·미배정이면 null이다.
// 같은 직급은 이름 가나다순(한국어 비교), 이름도 같으면 번호순이라 받은 차례와 상관없이 늘 같다.
// 서버 목록은 상한이 없어 화면이 받은 전체를 정렬해도 빠지는 사람이 없고, 부서마다 직급이 달라 묶음별로 정한다.
export function sortByRank(members: readonly TeamMember[], departmentId: string | null) {
  return members
    .map(member => ({ member, rank: rankOrderOf(member, departmentId) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        nameOrder.compare(a.member.name, b.member.name) ||
        idOrder(a.member.id, b.member.id),
    )
    .map(item => item.member)
}

// 운영진 > 사람과 부서 화면이 같이 쓴다. 회장단의 변경도 이 응답을 돌려주고, 화면은 받은 값으로 목록을 통째로 바꾼다.
export interface TeamResponse {
  members: TeamMember[]
  departments: TeamDepartment[]
}

// 부서 배정과 부서 직급(부장, 부부장, 없음). 이미 그 부서면 직급만 바꾼다.
export const AssignDepartmentSchema = z.strictObject({
  departmentId: recordIdInput,
  rank: z.enum(DEPARTMENT_RANKS).nullable(),
})
export type AssignDepartmentRequest = z.infer<typeof AssignDepartmentSchema>
// 부서 옮기기(DEC-91): 옛 부서 소속을 끝내고 새 부서 소속을 한 번에 연다. rank는 새 부서의 직급이다.
// 되돌리기가 옛 부서와 옛 직급으로 한 요청에 돌아가려고 직급을 받는다(기능 023 정한 것 4). 같은 부서면 400이다.
export const MoveDepartmentSchema = z
  .strictObject({
    fromDepartmentId: recordIdInput,
    toDepartmentId: recordIdInput,
    rank: z.enum(DEPARTMENT_RANKS).nullable(),
  })
  .refine(value => value.fromDepartmentId !== value.toDepartmentId)
export type MoveDepartmentRequest = z.infer<typeof MoveDepartmentSchema>
// 부회장 주고 거두기. 회장 직급은 넘기기로만 바뀐다.
export const ChangeRankSchema = z.strictObject({ rank: z.enum(['vice_president']).nullable() })
export type ChangeRankRequest = z.infer<typeof ChangeRankSchema>
// 회장 넘기기. 넘긴 사람은 직급 없음이 된다.
export const TransferPresidentSchema = z.strictObject({ memberId: recordIdInput })
export type TransferPresidentRequest = z.infer<typeof TransferPresidentSchema>

// 부서 이름의 상한. 지금 vada와 같은 20자다.
export const DEPARTMENT_NAME_MAX = 20
// 부서 만들기(회장단). 역할 없이 만든다.
export const CreateDepartmentSchema = z.strictObject({ name: text(DEPARTMENT_NAME_MAX) })
export type CreateDepartmentRequest = z.infer<typeof CreateDepartmentSchema>
// 이름 바꾸기와 재정 역할 주고 거두기(회장단). 화면은 이름과 역할을 함께 보낸다.
export const UpdateDepartmentSchema = z.strictObject({
  name: text(DEPARTMENT_NAME_MAX),
  role: z.enum(DEPARTMENT_ROLES).nullable(),
})
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentSchema>
