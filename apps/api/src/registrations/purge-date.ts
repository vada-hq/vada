import { KOREAN_DATE_LENGTH, koreanDateOf } from '@vada/contracts'

// 신청자 정보를 지우는 날(DEC-55): 행사 끝(없으면 시작, 없으면 양식 마감)의 한국 날짜 + 1년.
// 2월 29일은 다음 해 3월 1일이 된다(없는 날짜를 만들지 않으려고 날짜 계산을 달력에 맡긴다).
export function purgeOnOf(form: {
  eventEndsAt: Date | null
  eventStartsAt: Date | null
  closesAt: Date
}): string {
  const [year, month, day] = koreanDateOf(
    form.eventEndsAt ?? form.eventStartsAt ?? form.closesAt,
  ).split('-')
  return new Date(Date.UTC(Number(year) + 1, Number(month) - 1, Number(day)))
    .toISOString()
    .slice(0, KOREAN_DATE_LENGTH)
}
