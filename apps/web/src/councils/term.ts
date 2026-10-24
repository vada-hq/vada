import { requiredText } from '@/lib/use-form-check'

// 임기 끝은 시작보다 뒤여야 한다(스키마의 규칙). 두 날짜가 다 찼을 때만 순서를 본다.
const endsBeforeStart = ({ startsOn, endsOn }: { startsOn: string; endsOn: string }) =>
  startsOn !== '' && endsOn !== '' && endsOn <= startsOn

// 기수 이름과 임기의 문제(누를 때 확인한다).
export const termErrors = (term: { name: string; startsOn: string; endsOn: string }) => ({
  cohortName: requiredText(term.name, '기수 이름을'),
  startsOn: requiredText(term.startsOn, '임기 시작을'),
  endsOn:
    requiredText(term.endsOn, '임기 끝을') ??
    (endsBeforeStart(term) ? '임기 시작보다 뒤의 날짜를 입력해 주세요' : undefined),
})
