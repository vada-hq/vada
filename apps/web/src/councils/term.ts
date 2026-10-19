// 임기 끝은 시작보다 뒤여야 한다(스키마의 규칙). 버튼이 꺼진 까닭을 알리려고, 두 날짜가 다 찼을 때만 순서를 본다. 켜고 끄는 판단은 스키마의 safeParse가 한다.
export const TERM_ORDER_MESSAGE = '임기 끝은 시작보다 뒤여야 해요.'
export const endsBeforeStart = ({ startsOn, endsOn }: { startsOn: string; endsOn: string }) => startsOn !== '' && endsOn !== '' && endsOn <= startsOn
