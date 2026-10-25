import { koreanOf } from '@vada/contracts'
import { dayTime, dayTimeLabel, monthDay } from '@/lib/korean-date-text'

// 해를 견줄 기준은 홈의 오늘(한국 날짜)이다. 그날 한낮으로 두어 시간대와 관계없이 같은 해가 된다.
const noonOf = (today: string) => new Date(`${today}T12:00:00+09:00`)

// 끼룩이 한 줄의 기준 시각(DEC-95): 서버가 홈 응답을 만든 시각을 한국 시간으로 읽는다.
// 홈의 오늘과 같은 날이면 '14:05', 다른 날이면 '10월 25일 (일) 14:05'(올해가 아니면 해를 붙인다).
export function asOfLabel(asOf: string, today: string) {
  const { date, time } = dayTime(koreanOf(new Date(asOf)))
  return date === today ? time : dayTimeLabel(asOf, noonOf(today))
}

// 인사 카드의 날짜: 홈의 오늘 '10월 26일 (월)'.
export const greetingDate = (today: string) =>
  `${monthDay(today)} (${dayTime(`${today}T`).weekday})`
