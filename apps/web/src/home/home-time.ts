import { dateLabel } from '@/lib/korean-date-text'

// 홈의 날짜 '10월 26일 (월)': 인사 카드의 오늘과 다음 일정, 이번 주 줄. 해를 넘긴 일정에는 연도가 붙는다.
export const greetingDate = (date: string) => dateLabel(date)
