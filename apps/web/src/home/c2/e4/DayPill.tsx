import { CalendarOff, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { C2Event } from '../c2-data'
import { DAY_PILL, DAY_PILL_ICON, DAY_PILL_NONE, DAY_PILL_SET, TEXT_PILL } from './tokens'

// 남은 날 알약: 짙은 중립 면 + 시계 + 'D-2'/'오늘'. 줄마다 같은 폭이라 세로 열로 서서 남은 날이 먼저 읽힌다.
// 가까운 날도 위험 색을 쓰지 않는다(명세 6절: D-day는 위험 색 없이). 일정 미정은 옅은 면 + 빈 달력 그림만(글 '일정 미정'은 줄에 한 번만).
// 화면 읽기에는 다음 일정 글('D-2 신청 마감')을 한 번에 읽히게 알약은 숨기고 줄 글에 dday를 붙인다(EventRow).
export function DayPill({ event }: { event: C2Event }) {
  const next = event.next
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap',
        DAY_PILL,
        TEXT_PILL,
        next ? DAY_PILL_SET : DAY_PILL_NONE,
      )}
    >
      {next ? (
        <Timer className={DAY_PILL_ICON} strokeWidth={2.5} />
      ) : (
        <CalendarOff className={DAY_PILL_ICON} strokeWidth={2.25} />
      )}
      {next?.dday}
    </span>
  )
}
