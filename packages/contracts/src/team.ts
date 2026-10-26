import { z } from 'zod'
import { isUuid, text, token, UUID_LENGTH } from './input.js'
import {
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

// 운영진 목록의 한 줄. 들어온 순서와 시각을 보인다(DEC-47). 이메일은 보이지 않는다(바탕 spec G12).
export interface TeamMember {
  id: string
  name: string
  councilRank: CouncilRank | null
  departments: { id: string; rank: DepartmentRank | null }[]
  // 지금 소속을 연 시각(ISO). 다시 들어오면 다시 들어온 시각이다.
  joinedAt: string
}
// 미배정 운영진(DEC-87, DEC-91): 학생회 직급이 없고 열린 부서 소속이 없다. 목록에는 지금 기수의 끝나지 않은 소속과
// 열린 부서 소속만 오므로 이 줄 하나로 가린다. 회장단 홈의 미배정 수(서버 unassignedMembersOf)와 같은 대상이다(기능 023 정한 것 3).
export const isUnassignedMember = (member: Pick<TeamMember, 'councilRank' | 'departments'>) =>
  member.councilRank === null && member.departments.length === 0

export interface TeamDepartment {
  id: string
  name: string
  role: DepartmentRole | null
  memberCount: number
  // 한 번이라도 소속이 있었는가(끝난 소속 포함). 쓴 부서는 '없애기' 대신 '그만 쓰기'다(DEC-91). 서버는 늘 보낸다.
  used?: boolean
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
