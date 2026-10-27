import { addDays, weekdayOf } from '@/lib/month-grid'

const WEEK = 7
const MONDAY = 1

// 마감 고르기의 빠른 날. 학생회 업무 마감은 대부분 며칠 안이라 달력을 넘기지 않고 고르게 한다(Todoist 'Tomorrow·Next week', Linear 마감 메뉴).
// '다음 주 월요일'은 오늘이 월요일이어도 이레 뒤다.
export function quickDuePicks(today: string) {
  const toMonday = (MONDAY - weekdayOf(today) + WEEK) % WEEK || WEEK
  return [
    { label: '오늘', date: today },
    { label: '내일', date: addDays(today, 1) },
    { label: '다음 주 월요일', date: addDays(today, toMonday) },
  ]
}
