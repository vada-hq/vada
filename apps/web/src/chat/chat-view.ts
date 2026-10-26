import { koreanDateOf, koreanOf, type RoomSummary } from '@vada/contracts'
import { countLabel } from '@/components/ui/count-badge'

// 안 읽은 수 글. 옆 메뉴 수 배지와 같은 상한이다.
export const unreadLabel = (count: number) => countLabel(count)

const NAMES = {
  all_members: '공지방',
  leadership: '회장단방',
  department: '부서방',
  direct: '1:1 대화',
  inter_department: '부서 간 대화',
} as const

type Named = Pick<RoomSummary, 'type' | 'name' | 'eventName'>

// 부서방은 부서 이름, 1:1은 상대 이름을 서버가 준다. 나머지는 종류로 이름을 붙인다.
const baseName = (room: Named) => room.name ?? NAMES[room.type]

// 공간(행사, 우리 학생회) 안의 방 전환 이름: '공지방', '회장단방', '{부서} 방'(022 정한 것 28). 공간 이름은 탭 위 제목이 말한다.
export const switchName = (room: Named) =>
  room.type === 'department' && room.name !== null ? `${room.name} 방` : baseName(room)

// 목록·제목·홈 칩의 방 이름. 행사 방은 행사 이름을 앞에 붙여 학생회 방과 가른다:
// '{행사 이름} 공지방', '{행사 이름} {부서 이름} 방'(022 정한 것 1·27, Slack 채널 이름 접두사).
export const roomName = (room: Named) =>
  room.eventName ? `${room.eventName} ${switchName(room)}` : baseName(room)

// 보관된 행사 방의 입력칸 자리(022 정한 것 26·33)
export const ARCHIVED_LABEL = '완료된 행사'

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

// 메시지 흐름의 시각. 날짜는 구분선이 맡아 시각만 보인다.
export const clockLabel = (iso: string) => korean(iso).time

// 방 목록의 시각. 오늘(한국)이면 시각, 아니면 날짜다.
export function timeLabel(iso: string | null, now: Date) {
  if (iso === null) return ''
  const { date, time } = korean(iso)
  return date === koreanDateOf(now) ? time : dateLabel(iso, now)
}
