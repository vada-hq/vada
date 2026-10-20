import { useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import {
  cohortFrom,
  councilFrom,
  type CohortDraft,
  type CouncilDraft,
  type TitleKey,
} from './council-settings-form'

// 설정 화면에서 고치고 있는 값. 학생회가 다시 읽히면(권한 오류 뒤 다시 읽기, 다른 곳의 저장) 서버의 새 값으로 다시 채운다.
// 내용이 바뀐 쪽만 채워, 같은 내용의 다시 읽기나 다른 쪽에서 고치던 값은 건드리지 않는다.
export function useCouncilDrafts(view: CouncilView, onEdit: (form: 'council' | 'cohort') => void) {
  const [council, setCouncil] = useState(() => councilFrom(view))
  const [cohort, setCohort] = useState(() => cohortFrom(view))
  const councilKey = JSON.stringify(view.council)
  const cohortKey = JSON.stringify(view.cohort)
  const [seen, setSeen] = useState({ council: councilKey, cohort: cohortKey })
  if (seen.council !== councilKey || seen.cohort !== cohortKey) {
    setSeen({ council: councilKey, cohort: cohortKey })
    if (seen.council !== councilKey) setCouncil(councilFrom(view))
    if (seen.cohort !== cohortKey) setCohort(cohortFrom(view))
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
