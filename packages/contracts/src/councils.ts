import { z } from 'zod'
import { text, token } from './input.js'
import { KOREAN_DATE_LENGTH, koreanYearOf } from './korean-time.js'
import type { Action, CouncilRank, DepartmentRank, DepartmentRole } from './permissions.js'
import { memberNameInput } from './profile.js'
import { DEPARTMENT_NAME_MAX } from './team.js'

// 사람이 쓰는 이름의 상한. 학생회 이름은 지금 vada와 같은 50자다.
export const COUNCIL_NAME_MAX = 50
export const SCHOOL_NAME_MAX = 50
export const COHORT_NAME_MAX = 20
export const COUNCIL_UNITS = ['department', 'college', 'university'] as const
export type CouncilUnit = (typeof COUNCIL_UNITS)[number]

// 날짜(YYYY-MM-DD). 달력에 있는 날이고, koreanDateTime과 같은 범위(2000~2999년)만 받는다.
const datePattern = /^\d{4}-\d{2}-\d{2}$/
export const dateInput = token(KOREAN_DATE_LENGTH).refine(value => {
  if (!datePattern.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, KOREAN_DATE_LENGTH) === value &&
    value >= '2000-01-01' &&
    value <= '2999-12-31'
  )
})

// 운영 연도 선택지: 한국 날짜로 작년, 올해, 내년(DEC-87). 화면의 고르기와 서버의 확인이 같이 쓴다.
export function operatingYearsOf(now: Date): number[] {
  const year = Number(koreanYearOf(now))
  return [year - 1, year, year + 1]
}
// 계약은 날짜 입력과 같은 범위의 정수만 받는다. 오늘에 기대는 선택지 확인은 서버가 operatingYearsOf로 한다.
const YEAR_MIN = 2000
const YEAR_MAX = 2999

// 학생회를 만들 때 함께 생기는 재정 역할 부서의 기본 이름(DEC-16). 메뉴 '재정'과 맞고, 만들 때와 뒤에 고친다.
export const DEFAULT_FINANCE_DEPARTMENT_NAME = '재정부'
// 처음 부서 목록은 재정 역할 부서를 더해 모두 20개까지다.
export const INITIAL_DEPARTMENTS_MAX = 20

// 처음 부서 이름(재정 역할 부서 포함)은 한 학생회 안에서 겹칠 수 없다(DB UNIQUE). 다듬은 이름끼리 비교한다.
const departmentNamesUnique = (value: {
  financeDepartmentName?: string | undefined
  departments?: string[] | undefined
}) => {
  const names = [
    value.financeDepartmentName ?? DEFAULT_FINANCE_DEPARTMENT_NAME,
    ...(value.departments ?? []),
  ]
  return new Set(names).size === names.length
}

// 학생회 만들기(바탕 spec G6, DEC-87): 학생회 정보, 운영 연도, 처음 부서 목록, 내 이름.
// 기수 이름과 기간은 운영 연도로 서버가 채운다. 부서 둘을 빼면 '재정부' 하나다. 내 이름은 로그인에 처음 운영진을 이을 때만 쓴다.
export const CreateCouncilSchema = z
  .strictObject({
    name: text(COUNCIL_NAME_MAX),
    unit: z.enum(COUNCIL_UNITS),
    schoolName: text(SCHOOL_NAME_MAX),
    year: z.number().int().min(YEAR_MIN).max(YEAR_MAX),
    financeDepartmentName: text(DEPARTMENT_NAME_MAX).optional(),
    departments: z
      .array(text(DEPARTMENT_NAME_MAX))
      .max(INITIAL_DEPARTMENTS_MAX - 1)
      .optional(),
    memberName: memberNameInput.optional(),
  })
  .refine(departmentNamesUnique, { path: ['departments'] })
export type CreateCouncilRequest = z.infer<typeof CreateCouncilSchema>

// 내 학생회 목록의 한 줄: 학생회, 학생회 직급, 지금 부서 소속
// 유형과 학교는 여러 학생회에 든 사람이 같은 이름(총학생회)의 학생회를 가리는 데 쓴다(DEC-87).
export interface MyCouncil {
  id: string
  name: string
  unit: CouncilUnit
  schoolName: string
  councilRank: CouncilRank | null
  departments: { id: string; name: string; rank: DepartmentRank | null }[]
}
export interface MyCouncilsResponse {
  councils: MyCouncil[]
}
export interface CreateCouncilResponse {
  council: MyCouncil
}

// 직급 표시 이름. 학생회가 정한다(DEC-16). 비상대책위원장도 회장 직급에 표시 이름만 바꾼다.
export interface CouncilTitles {
  president: string
  vicePresident: string
  head: string
  viceHead: string
}
// 학생회 하나: 학생회 정보, 지금 기수, 내 직급과 부서, 내 권한 목록. 화면은 permissions로 동작 버튼을 보이거나 숨긴다(DEC-38).
export interface CouncilView {
  council: {
    id: string
    name: string
    unit: CouncilUnit
    schoolName: string
    titles: CouncilTitles
  }
  cohort: { id: string; name: string; startsOn: string; endsOn: string }
  me: {
    memberId: string
    name: string
    councilRank: CouncilRank | null
    departments: {
      id: string
      name: string
      role: DepartmentRole | null
      rank: DepartmentRank | null
    }[]
  }
  permissions: Action[]
}

// 직급 표시 이름의 상한
export const RANK_TITLE_MAX = 20
// 학생회 정보와 직급 표시 이름 고치기(회장단). 화면은 네 표시 이름을 모두 보낸다.
export const UpdateCouncilSettingsSchema = z.strictObject({
  name: text(COUNCIL_NAME_MAX),
  unit: z.enum(COUNCIL_UNITS),
  schoolName: text(SCHOOL_NAME_MAX),
  titles: z.strictObject({
    president: text(RANK_TITLE_MAX),
    vicePresident: text(RANK_TITLE_MAX),
    head: text(RANK_TITLE_MAX),
    viceHead: text(RANK_TITLE_MAX),
  }),
})
export type UpdateCouncilSettingsRequest = z.infer<typeof UpdateCouncilSettingsSchema>
// 지금 기수의 이름과 기간 고치기(회장단). 시작일은 오늘 이전이어야 한다(서버가 본다, DEC-57).
export const UpdateCohortSchema = z
  .strictObject({ name: text(COHORT_NAME_MAX), startsOn: dateInput, endsOn: dateInput })
  .refine(value => value.endsOn > value.startsOn, { path: ['endsOn'] })
export type UpdateCohortRequest = z.infer<typeof UpdateCohortSchema>
