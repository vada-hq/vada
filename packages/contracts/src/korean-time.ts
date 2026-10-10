import { token } from './input.js'

// 이 앱은 한국에서만 쓴다. 일시는 한국 시각 "YYYY-MM-DDTHH:mm"으로 주고받아 기기의 시간대와 상관없이 같은 순간이 되게 한다.
const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
// 달력에 있는 시각이고, DB 검사와 같은 범위(2000~2999년)만 받는다.
export const koreanDateTime = token(16).refine(value => {
  if (!pattern.test(value)) return false
  const parsed = new Date(`${value}:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 16) === value
    && value >= '2000-01-01T00:00' && value <= '2999-12-31T23:59'
})
export const dateFromKorean = (value: string) => new Date(`${value}:00+09:00`)
export const koreanOf = (date: Date) =>
  date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hourCycle: 'h23' }).slice(0, 16).replace(' ', 'T')
