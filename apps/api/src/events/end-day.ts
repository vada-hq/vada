import { koreanDateOf } from '@vada/contracts'

// 행사 끝 날짜(한국). 끝 시각이 없으면 시작 시각이고, 둘 다 없으면(날짜 미정) null이다.
// 참가비 수입의 받은 날과 결산 공개 조건이 같은 날짜를 보도록 한 곳에 둔다(DEC-70).
export function eventEndDayOf(row: { startsAt: Date | null; endsAt: Date | null }) {
  const ended = row.endsAt ?? row.startsAt
  return ended ? koreanDateOf(ended) : null
}
