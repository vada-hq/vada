import { z } from 'zod'
import { text, token } from './input.js'

// 학생회·부서 이름과 직책의 상한. DB CHECK(0010 직책, 0011 이름)와 같은 값이다.
export const ORGANIZATION_NAME_MAX = 50
export const DEPARTMENT_NAME_MAX = 20
export const MEMBER_TITLE_MAX = 20
export const CREATE_DEPARTMENTS_MAX = 20
// 학생회를 만들면 자동으로 생기는 회장단의 이름. 나중에 바꿀 수 있다(비상대책위원회 등).
export const LEADERSHIP_DEFAULT_NAME = '회장단'

const departmentName = text(DEPARTMENT_NAME_MAX)
// 만들 때 부서 이름은 서로 겹치거나 회장단과 같으면 안 된다. text()가 앞뒤 공백을 지운 뒤 비교한다.
export const CreateOrganizationSchema = z.strictObject({
  name: text(ORGANIZATION_NAME_MAX),
  departments: z.array(z.strictObject({ name: departmentName, handlesFinance: z.boolean() })).max(CREATE_DEPARTMENTS_MAX),
}).refine(({ departments }) => {
  const names = departments.map(department => department.name)
  return new Set(names).size === names.length && !names.includes(LEADERSHIP_DEFAULT_NAME)
}, { path: ['departments'] })
export const CreateDepartmentSchema = z.strictObject({ name: departmentName })
// 편집 대화상자가 이름과 구매 승인을 함께 보낸다. 회장단은 handlesFinance가 늘 false다.
export const UpdateDepartmentSchema = z.strictObject({ name: departmentName, handlesFinance: z.boolean() })
export const DeleteDepartmentSchema = z.strictObject({})
// null은 미배정이다.
export const AssignDepartmentSchema = z.strictObject({ departmentId: token(64).nullable() })
// null은 직책 지우기다.
export const UpdateMemberTitleSchema = z.strictObject({ title: text(MEMBER_TITLE_MAX).nullable() })

export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationSchema>
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentSchema>
