import { operatingYearsOf } from '@vada/contracts'
import { requiredText } from '@/lib/use-form-check'

// 운영 연도는 보내는 때의 선택지(작년·올해·내년) 안이어야 한다. 12월 31일에 연 양식을 1월 1일에 보내면 작년이 선택지 밖이라
// 서버도 받지 않으므로(400), 누를 때 그 칸 아래에 알린다. 선택지는 다시 그릴 때 새해 기준으로 바뀐다.
export const operatingYearError = (year: string, now = new Date()) =>
  operatingYearsOf(now).map(String).includes(year) ? undefined : '운영 연도를 다시 골라 주세요'

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
