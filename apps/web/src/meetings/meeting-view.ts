import {
  dateFromKorean,
  dayTimeLabel,
  KOREAN_DATE_LENGTH,
  type MeetingStatus,
  type MeetingSummary,
} from '@vada/contracts'
import { MY_MEETING_TODO } from './meeting-text'

const TIME_START = KOREAN_DATE_LENGTH + 1
const MINUTE_MS = 60_000
const HOUR_MINUTES = 60
export function meetingTime(start: string, end: string | null) {
  const label = dayTimeLabel(dateFromKorean(start).toISOString())
  if (!end) return label
  const until =
    end.slice(0, KOREAN_DATE_LENGTH) === start.slice(0, KOREAN_DATE_LENGTH)
      ? end.slice(TIME_START)
      : dayTimeLabel(dateFromKorean(end).toISOString())
  return `${label}~${until}`
}
export function meetingDuration(start: string, end: string | null) {
  if (!end) return '미정'
  const minutes = Math.round(
    (dateFromKorean(end).getTime() - dateFromKorean(start).getTime()) / MINUTE_MS,
  )
  const hours = Math.floor(minutes / HOUR_MINUTES)
  const rest = minutes % HOUR_MINUTES
  return [hours ? `${hours}시간` : '', rest ? `${rest}분` : ''].filter(Boolean).join(' ') || '0분'
}
const upcoming = (meeting: MeetingSummary, now: string) => (meeting.endsAt ?? meeting.heldAt) >= now
const order = (a: MeetingSummary, b: MeetingSummary, now: string) => {
  const nextA = upcoming(a, now)
  const nextB = upcoming(b, now)
  if (nextA !== nextB) return nextA ? -1 : 1
  return nextA ? a.heldAt.localeCompare(b.heldAt) : b.heldAt.localeCompare(a.heldAt)
}
// 행사 회의 탭은 한 묶음이라 회의 메뉴 묶음 안과 같은 차례만 쓴다.
export const sortedMeetings = (items: MeetingSummary[], now: string) =>
  [...items].sort((a, b) => order(a, b, now))
// 내 회의 줄의 할 일(MEET-MY-01 '진행 중·회의록 정리 필요·참석 예정'). 진행 권한을 따로 두지 않아(DEC-104 ②)
// 와이어프레임의 '진행 중 · 진행 권한'은 '진행 중'만 남긴다. 서버의 mine에는 완료·취소가 없다.
const MY_TODO_ORDER: MeetingStatus[] = ['in_progress', 'wrapping_up', 'scheduled']
export function myMeetingRows(items: MeetingSummary[]) {
  const rank = (meeting: MeetingSummary) => {
    const index = MY_TODO_ORDER.indexOf(meeting.status)
    return index < 0 ? MY_TODO_ORDER.length : index
  }
  return [...items]
    .sort((a, b) => rank(a) - rank(b) || a.heldAt.localeCompare(b.heldAt))
    .map(meeting => ({ meeting, todo: MY_MEETING_TODO[meeting.status] }))
}
export type MeetingGroup = {
  id: string
  name: string
  meetings: MeetingSummary[]
  nearest: MeetingSummary | undefined
}
function matchesMeeting(meeting: MeetingSummary, search: string, status: MeetingStatus | null) {
  if (status && meeting.status !== status) return false
  return `${meeting.title} ${meeting.place ?? ''}`
    .toLocaleLowerCase()
    .includes(search.trim().toLocaleLowerCase())
}
export function meetingGroups(
  items: MeetingSummary[],
  search: string,
  status: MeetingStatus | null,
  now: string,
): MeetingGroup[] {
  const groups = new Map<string, MeetingGroup>()
  for (const meeting of items.filter(item => matchesMeeting(item, search, status))) {
    const id = meeting.event?.id ?? 'council'
    const group: MeetingGroup = groups.get(id) ?? {
      id,
      name: meeting.event?.name ?? '정기·상시 회의',
      meetings: [],
      nearest: undefined,
    }
    group.meetings.push(meeting)
    groups.set(id, group)
  }
  for (const group of groups.values()) {
    group.meetings.sort((a, b) => order(a, b, now))
    group.nearest = group.meetings.find(item => item.status !== 'cancelled' && upcoming(item, now))
  }
  return [...groups.values()].sort((a, b) => groupOrder(a, b, now))
}
function groupOrder(a: MeetingGroup, b: MeetingGroup, now: string) {
  if (a.id === 'council') return -1
  if (b.id === 'council') return 1
  return order(a.nearest ?? a.meetings[0]!, b.nearest ?? b.meetings[0]!, now)
}
