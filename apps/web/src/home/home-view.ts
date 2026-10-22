import { KOREAN_DATE_LENGTH, koreanOf, type HomeMine, type HomeTaskGroup } from '@vada/contracts'
import { monthDay } from '@/lib/korean-date-text'

export const GROUP_LABEL: Record<HomeTaskGroup, string> = {
  overdue: '지남',
  today: '오늘',
  soon: '7일 안',
}

// 내 업무가 하나도 없는가. 마감이 먼 것과 마감 없는 것도 있으면 비지 않았다.
export const mineIsEmpty = ({ counts }: HomeMine) =>
  counts.overdue + counts.today + counts.soon + counts.later + counts.noDue === 0

export const EVENT_SETTLED_LABEL = '완료할 수 있어요'
export const settlementLabel = ({ remaining, settled }: { remaining: number; settled: boolean }) =>
  settled ? EVENT_SETTLED_LABEL : `정산에 남은 것 ${remaining}`

// 요청을 낸 날(한국 날짜): '10월 20일'
export const createdDay = (iso: string) =>
  monthDay(koreanOf(new Date(iso)).slice(0, KOREAN_DATE_LENGTH))
