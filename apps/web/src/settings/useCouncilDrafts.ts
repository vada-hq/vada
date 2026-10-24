import { useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import { sameJson } from '@/lib/same-json'
import {
  cohortFrom,
  councilFrom,
  type CohortDraft,
  type CouncilDraft,
  type TitleKey,
} from './council-settings-form'

// 설정 화면에서 고치고 있는 값. 학생회가 다시 읽히면(권한 오류 뒤 다시 읽기, 15초 다시 읽기, 다른 곳의 저장) 서버의 새 값으로 다시 채운다.
// 내용이 바뀐 쪽만 채우고, 그 쪽을 고치던 중이면(처음 받은 값과 다르면) 쓰던 값을 지킨다. 서버 값과 다른 채로 저장하면 저장 결과가 서버의 값이 된다.
export function useCouncilDrafts(view: CouncilView, onEdit: (form: 'council' | 'cohort') => void) {
  const [council, setCouncil] = useState(() => councilFrom(view))
  const [cohort, setCohort] = useState(() => cohortFrom(view))
  // 마지막으로 받은 서버 값. 폼이 이것과 다르면 고치던 중이다.
  const [base, setBase] = useState({ council: councilFrom(view), cohort: cohortFrom(view) })
  const councilKey = JSON.stringify(view.council)
  const cohortKey = JSON.stringify(view.cohort)
  const [seen, setSeen] = useState({ council: councilKey, cohort: cohortKey })
  if (seen.council !== councilKey || seen.cohort !== cohortKey) {
    setSeen({ council: councilKey, cohort: cohortKey })
    const next = { council: councilFrom(view), cohort: cohortFrom(view) }
    // 서버 값이 바뀐 쪽만 본다. 고치던 중이 아니거나 서버 값과 이미 같으면(내 저장) 새 값으로 채운다.
    const refill = (changed: boolean, draft: unknown, was: unknown, now: unknown) =>
      changed && (sameJson(draft, was) || sameJson(draft, now))
    const fillCouncil = refill(seen.council !== councilKey, council, base.council, next.council)
    const fillCohort = refill(seen.cohort !== cohortKey, cohort, base.cohort, next.cohort)
    if (fillCouncil) setCouncil(next.council)
    if (fillCohort) setCohort(next.cohort)
    setBase({
      council: fillCouncil ? next.council : base.council,
      cohort: fillCohort ? next.cohort : base.cohort,
    })
  }
  return {
    council,
    cohort,
    editCouncil: (patch: Partial<CouncilDraft>) => {
      setCouncil(current => ({ ...current, ...patch }))
      onEdit('council')
    },
    editTitle: (key: TitleKey, value: string) => {
      setCouncil(current => ({ ...current, titles: { ...current.titles, [key]: value } }))
      onEdit('council')
    },
    editCohort: (patch: Partial<CohortDraft>) => {
      setCohort(current => ({ ...current, ...patch }))
      onEdit('cohort')
    },
  }
}
