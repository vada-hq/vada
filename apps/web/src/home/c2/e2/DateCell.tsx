import { cn } from '@/lib/utils'
import type { C2Next } from '../c2-data'
import { DATE_CELL, DATE_NUM, DATE_SMALL, DATE_UNDECIDED } from './tokens'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const parse = (date: string) => new Date(`${date}T00:00:00Z`)

// 왼쪽 날짜 칸: 다음 일정 날짜를 달력 조각(월 / 날짜 숫자 / 요일)으로 세운다. 면·테두리 없이 글자로만 세워
// 작은 상자 셋이 반복돼 보이지 않게 한다(c2-refs 나 절의 위험). 일정 미정이면 숫자 자리에 '미정'.
export function DateCell({ next }: { next: C2Next | null }) {
  const date = next ? parse(next.date) : null
  return (
    <div
      aria-hidden
      className={cn('flex shrink-0 flex-col items-center justify-center text-center', DATE_CELL)}
    >
      <span className={cn('text-fg-tertiary', DATE_SMALL)}>
        {date ? `${date.getUTCMonth() + 1}월` : ' '}
      </span>
      {date ? (
        <span className={cn('text-fg', DATE_NUM)}>{date.getUTCDate()}</span>
      ) : (
        <span className={cn('text-fg-tertiary', DATE_UNDECIDED)}>미정</span>
      )}
      <span className={cn('text-fg-tertiary', DATE_SMALL)}>
        {date ? WEEK[date.getUTCDay()] : ' '}
      </span>
    </div>
  )
}
