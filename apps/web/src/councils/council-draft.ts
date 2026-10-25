import {
  DEFAULT_FINANCE_DEPARTMENT_NAME,
  INITIAL_DEPARTMENTS_MAX,
  koreanYearOf,
  type CouncilUnit,
} from '@vada/contracts'
import { myNameErrors } from '@/lib/my-name'
import { requiredText, withContract, type FieldErrors, type Parsed } from '@/lib/use-form-check'
import { operatingYearError } from './term'

// 부서 줄 하나. key는 줄을 빼고 더해도 칸이 섞이지 않게 붙인 화면 안의 번호다.
type DepartmentDraft = { key: number; name: string }

// 학생회 만들기의 고치는 값. 1·2단계 값은 화면에만 있고 [이전]으로 오가도 남는다(기능 020 정한 것 1).
// 운영 연도는 고르기 값(글자)으로 두고 보낼 때 숫자로 바꾼다. 기수 이름과 기간은 서버가 운영 연도로 채운다(DEC-87).
export type CreateCouncilDraft = {
  unit: CouncilUnit
  schoolName: string
  name: string
  year: string
  financeName: string
  departments: DepartmentDraft[]
  memberName: string
}
export type DraftTextKey = 'unit' | 'schoolName' | 'name' | 'year' | 'financeName' | 'memberName'

// 미리 둔 부서와 더하기 단추(기능 020 정한 것 6, 학생회 26곳 집계).
const PRESET_DEPARTMENTS = ['기획부', '홍보부']
const SUGGESTED_DEPARTMENTS = ['복지부', '문화부', '체육부', '학술부']

// 기본 유형은 가장 흔한 학부·학과, 운영 연도는 올해(한국 날짜)다. 내 이름은 Google 이름을 미리 채운다.
export function initialDraft(memberName: string, now = new Date()): CreateCouncilDraft {
  return {
    unit: 'department',
    schoolName: '',
    name: '',
    year: koreanYearOf(now),
    financeName: DEFAULT_FINANCE_DEPARTMENT_NAME,
    departments: PRESET_DEPARTMENTS.map((name, key) => ({ key, name })),
    memberName,
  }
}

// 보낼 본문. 내 이름은 로그인에 이어진 운영진이 없을 때만 보낸다(이어졌으면 서버도 무시한다).
export const createRequestOf = (draft: CreateCouncilDraft, askName: boolean) => ({
  name: draft.name,
  unit: draft.unit,
  schoolName: draft.schoolName,
  year: Number(draft.year),
  financeDepartmentName: draft.financeName,
  departments: draft.departments.map(department => department.name),
  ...(askName && { memberName: draft.memberName }),
})

// 목록에 없는 더하기 단추만 보인다. 재정 부서를 더해 20개가 차면 더하지 못한다.
export const canAddDepartment = (draft: CreateCouncilDraft) =>
  draft.departments.length < INITIAL_DEPARTMENTS_MAX - 1
export const suggestionsOf = (draft: CreateCouncilDraft) => {
  const taken = new Set([draft.financeName, ...draft.departments.map(row => row.name)].map(trim))
  return SUGGESTED_DEPARTMENTS.filter(name => !taken.has(name))
}
const trim = (value: string) => value.trim()

// 칸 이름은 계약의 경로와 같다. 그래야 계약이 잡은 문제(너무 긴 이름)도 같은 칸 아래에 보인다.
const BASIC_KEYS = new Set(['unit', 'schoolName', 'name', 'year'])
const pick = (errors: FieldErrors, keep: (key: string) => boolean) =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => keep(key)))

// 1단계의 문제: 학교, 학생회 이름, 운영 연도.
export function basicErrors(draft: CreateCouncilDraft, parsed: Parsed): FieldErrors {
  const errors = withContract(
    {
      schoolName: requiredText(draft.schoolName, '학교를'),
      name: requiredText(draft.name, '학생회 이름을'),
      year: operatingYearError(draft.year),
    },
    parsed,
  )
  return pick(errors, key => BASIC_KEYS.has(key))
}

// 2단계의 문제: 빈 부서 이름, 목록 안의 같은 이름(뒤에 온 줄에), 내 이름. 같은 이름은 계약처럼 다듬은 이름끼리 비교한다.
export function structureErrors(
  draft: CreateCouncilDraft,
  parsed: Parsed,
  askName: boolean,
): FieldErrors {
  const names = [draft.financeName, ...draft.departments.map(row => row.name)].map(trim)
  const nameError = (name: string, index: number) =>
    requiredText(name, '부서 이름을') ??
    (names.indexOf(name) === index ? undefined : '같은 이름의 부서가 있어요')
  const rows: FieldErrors = { financeDepartmentName: nameError(names[0]!, 0) }
  draft.departments.forEach((_, index) => {
    rows[`departments.${index}`] = nameError(names[index + 1]!, index + 1)
  })
  if (askName) rows.memberName = myNameErrors(draft.memberName).name
  return pick(withContract(rows, parsed), key => !BASIC_KEYS.has(key))
}
