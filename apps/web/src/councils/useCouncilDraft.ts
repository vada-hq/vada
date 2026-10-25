import { useRef, useState } from 'react'
import { CreateCouncilSchema, koreanYearOf, operatingYearsOf } from '@vada/contracts'
import { createRequestOf, initialDraft, type DraftTextKey } from './council-draft'
import { isOperatingYear, YEAR_OUT_OF_RANGE } from './term'

// 학생회 만들기 1·2단계가 같이 고치는 값과 운영 연도 선택지. 서버를 부르지 않아 부품 확인 화면도 그대로 쓴다.
// opened는 연 때의 오늘이다(부품 확인 화면은 날짜를 고정한다).
export function useCouncilDraft(memberName: string, opened?: Date) {
  const [draft, setDraft] = useState(() => initialDraft(memberName, opened))
  // 운영 연도 선택지. 연 때의 오늘로 두고 누를 때 다시 센다(양식을 연 채 해가 바뀌면 선택지도 바뀐다).
  const [years, setYears] = useState(() => operatingYearsOf(opened ?? new Date()))
  const [yearReset, setYearReset] = useState(false)
  const nextKey = useRef(draft.departments.length)

  // 고른 해가 새 선택지 밖이면 올해로 되돌리고 true를 돌려준다. 그러지 않으면 선택칸은 첫 항목을 보이는데 값은 옛 해로 남는다.
  // 되돌린 것은 운영 연도 칸 아래에 알리고, 그 칸을 다시 고르면 걷는다.
  function refreshYears() {
    const now = new Date()
    const stale = !isOperatingYear(draft.year, now)
    setYears(operatingYearsOf(now))
    setYearReset(stale)
    if (stale) setDraft(current => ({ ...current, year: koreanYearOf(now) }))
    return stale
  }
  const set = (key: DraftTextKey) => (event: { target: { value: string } }) => {
    if (key === 'year') setYearReset(false)
    setDraft(current => ({ ...current, [key]: event.target.value }))
  }
  const renameDepartment = (key: number, name: string) =>
    setDraft(current => ({
      ...current,
      departments: current.departments.map(row => (row.key === key ? { key, name } : row)),
    }))
  const removeDepartment = (key: number) =>
    setDraft(current => ({
      ...current,
      departments: current.departments.filter(row => row.key !== key),
    }))
  // 더한 줄의 key를 돌려준다(빈 줄은 그 칸으로 초점을 옮긴다).
  function addDepartment(name = '') {
    const key = nextKey.current++
    setDraft(current => ({ ...current, departments: [...current.departments, { key, name }] }))
    return key
  }
  // 서버와 같은 스키마로 판단한다. 칸 확인이 다루지 않는 길이 상한은 이 결과로 칸 아래에 보인다.
  const parse = (askName: boolean) => CreateCouncilSchema.safeParse(createRequestOf(draft, askName))
  return {
    draft,
    set,
    years,
    refreshYears,
    yearError: yearReset ? YEAR_OUT_OF_RANGE : undefined,
    renameDepartment,
    removeDepartment,
    addDepartment,
    parse,
  }
}
export type CouncilDraftState = ReturnType<typeof useCouncilDraft>
