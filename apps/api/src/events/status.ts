import { dateFromKorean, koreanDateOf, type EventStatus } from '@vada/contracts'

const SECOND_MS = 1000
const DAY_MS = 86_400_000

// 행사가 끝나는 때. 끝을 정하지 않았으면 시작한 날(한국) 23:59:59까지다. 한국은 일광절약시간이 없어 하루는 24시간이다.
// 목록 정렬의 SQL(queries.ts의 endsAtSql)이 같은 규칙을 쓴다. 한쪽을 고치면 다른 쪽도 고친다.
function eventEndOf(startsAt: Date, endsAt: Date | null): Date {
  if (endsAt) return endsAt
  const dayStart = dateFromKorean(`${koreanDateOf(startsAt)}T00:00`)
  return new Date(dayStart.getTime() + DAY_MS - SECOND_MS)
}

// 상태는 저장하지 않고 센다. 끝은 그 초까지 진행 중이라, 지금을 초로 내려 견준다.
export function eventStatusOf(startsAt: Date | null, endsAt: Date | null, now: Date): EventStatus {
  if (!startsAt) return 'tbd'
  const second = Math.floor(now.getTime() / SECOND_MS) * SECOND_MS
  if (second > eventEndOf(startsAt, endsAt).getTime()) return 'ended'
  return now.getTime() < startsAt.getTime() ? 'upcoming' : 'ongoing'
}
