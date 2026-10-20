import { koreanDateOf, koreanOf, type RoomSummary } from '@vada/contracts'

const MAX_BADGE = 99
export const unreadLabel = (count: number) => (count > MAX_BADGE ? `${MAX_BADGE}+` : String(count))

const NAMES = {
  all_members: '운영진 전체방',
  leadership: '회장단방',
  department: '부서방',
  direct: '1:1 대화',
  inter_department: '부서 간 대화',
} as const

// 부서방은 부서 이름, 1:1은 상대 이름을 서버가 준다. 나머지는 종류로 이름을 붙인다.
export const roomName = (room: Pick<RoomSummary, 'type' | 'name'>) => room.name ?? NAMES[room.type]

const korean = (iso: string) => {
  const [date = '', time = ''] = koreanOf(new Date(iso)).split('T')
  const [year = '', month = '', day = ''] = date.split('-')
  return { date, time, year, month: Number(month), day: Number(day) }
}

// 한국 날짜로 보여 준다(기기 시간대와 상관없이). 같은 해면 연도를 뺀다.
export function dateLabel(iso: string, now: Date) {
  const { year, month, day } = korean(iso)
  return year === koreanOf(now).slice(0, year.length)
    ? `${month}월 ${day}일`
    : `${year}년 ${month}월 ${day}일`
}

// 방 카드와 메시지의 시각. 오늘(한국)이면 시각, 아니면 날짜다.
export function timeLabel(iso: string | null, now: Date) {
  if (iso === null) return ''
  const { date, time } = korean(iso)
  return date === koreanDateOf(now) ? time : dateLabel(iso, now)
}
