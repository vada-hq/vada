import type { CouncilView } from '@vada/contracts'

export type Form = 'council' | 'cohort'
export type Message = { form: Form; kind: 'notice' | 'error'; text: string }
export const titleFields = [
  ['president', '회장'],
  ['vicePresident', '부회장'],
  ['head', '부장'],
  ['viceHead', '부부장'],
] as const
export type TitleKey = (typeof titleFields)[number][0]

export const councilFrom = (view: CouncilView) => ({
  name: view.council.name,
  unit: view.council.unit,
  schoolName: view.council.schoolName,
  titles: { ...view.council.titles },
})
export const cohortFrom = (view: CouncilView) => ({
  name: view.cohort.name,
  startsOn: view.cohort.startsOn,
  endsOn: view.cohort.endsOn,
})
export type CouncilDraft = ReturnType<typeof councilFrom>
export type CohortDraft = ReturnType<typeof cohortFrom>
