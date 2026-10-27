import { dayTime, monthDay } from '@/lib/korean-date-text'

// 인사 카드의 날짜: 홈의 오늘 '10월 26일 (월)'.
export const greetingDate = (today: string) =>
  `${monthDay(today)} (${dayTime(`${today}T`).weekday})`
