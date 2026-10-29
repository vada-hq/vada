import { KOREAN_DATE_LENGTH, koreanDateOf } from '@vada/contracts'

// 신청자 정보를 지우는 날(DEC-55): 행사 끝(없으면 시작, 없으면 양식 마감)의 한국 날짜 + 1년.
// 2월 29일은 다음 해 3월 1일이 된다(없는 날짜를 만들지 않으려고 날짜 계산을 달력에 맡긴다).
// 셋 다 없으면(일시 미정 행사의 마감 없는 초안) 셀 근거가 없어 null이다. 초안은 신청이 없어 지울 것도 없다.
export function purgeOnOf(form: {
  eventEndsAt: Date | null
  eventStartsAt: Date | null
  closesAt: Date | null
}): string | null {
  const base = form.eventEndsAt ?? form.eventStartsAt ?? form.closesAt
  if (base === null) return null
  const [year, month, day] = koreanDateOf(base).split('-')
  return new Date(Date.UTC(Number(year) + 1, Number(month) - 1, Number(day)))
    .toISOString()
    .slice(0, KOREAN_DATE_LENGTH)
}
