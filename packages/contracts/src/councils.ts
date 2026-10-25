import { z } from 'zod'
import { text, token } from './input.js'
import { KOREAN_DATE_LENGTH } from './korean-time.js'
import type { Action, CouncilRank, DepartmentRank, DepartmentRole } from './permissions.js'

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

// 학생회 만들기(바탕 spec G6): 학생회 정보와 첫 기수. 끝일은 시작일보다 뒤다(DB CHECK ends_on > starts_on).
export const CreateCouncilSchema = z
  .strictObject({
    name: text(COUNCIL_NAME_MAX),
    unit: z.enum(COUNCIL_UNITS),
    schoolName: text(SCHOOL_NAME_MAX),
    cohortName: text(COHORT_NAME_MAX),
    startsOn: dateInput,
    endsOn: dateInput,
  })
  .refine(value => value.endsOn > value.startsOn, { path: ['endsOn'] })
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
