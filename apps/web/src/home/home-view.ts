import {
  KOREAN_DATE_LENGTH,
  koreanOf,
  type EventSummary,
  type HomeEventCard,
  type HomeList,
  type HomeMine,
  type RoomSummary,
} from '@vada/contracts'
import { monthDay } from '@/lib/korean-date-text'

// 새로 더한 부분(내 요청, 이번 주 행사)은 앞의 몇 줄만 보이고 나머지는 원래 화면으로 넘긴다.
export const SHORT_LIST = 3
// 이번 주 행사: 오늘부터 이 날수 안에 시작하는 행사
const WEEK_DAYS = 7
const DAY_MS = 86_400_000

const koreanDay = (iso: string) => koreanOf(new Date(iso)).slice(0, KOREAN_DATE_LENGTH)
// 'YYYY-MM-DD' 두 날짜 사이의 날 수(달력으로 센다)
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

// 내 업무 중 줄로 보일 것: 지남과 오늘. 그 뒤는 업무 화면이 맡는다(네이버웍스 Today, Planner My Day).
export const mineRows = ({ tasks }: HomeMine) =>
  tasks.filter(task => task.group === 'overdue' || task.group === 'today')

// 줄로 보이지 않은 내 업무의 수: '7일 안 1 · 나중 3 · 마감 없음 1'. 0은 뺀다.
export function laterSummary({ counts }: HomeMine) {
  return [
    counts.soon > 0 && `7일 안 ${counts.soon}`,
    counts.later > 0 && `나중 ${counts.later}`,
    counts.noDue > 0 && `마감 없음 ${counts.noDue}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

// 내 업무에 이미 보이는 줄은 다른 부분에서 뺀다(같은 것을 두 부분에 싣지 않는다, DEC-69).
export function withoutIds(list: HomeList, ids: Set<string>): HomeList {
  const tasks = list.tasks.filter(task => !ids.has(task.id))
  return { tasks, total: list.total - (list.tasks.length - tasks.length) }
}

// 시작까지 남은 날: '오늘', '내일', 'D-3'
export function dDay(today: string, startsAt: string) {
  const days = daysBetween(today, startsAt.slice(0, KOREAN_DATE_LENGTH))
  if (days <= 0) return '오늘'
  return days === 1 ? '내일' : `D-${days}`
}

const risky = ({ tasks }: HomeEventCard) => tasks.overdue + tasks.unassigned > 0
// 학생회의 행사 차례: 끝나지 않은 것 중 막힌 것 → 나머지(서버 차례: 진행 중, 예정, 날짜 미정) → 정산이 남은 끝난 행사.
const EVENT_RANK = ['risky', 'open', 'ended'] as const
const rankOf = (card: HomeEventCard) =>
  EVENT_RANK.indexOf(card.settlement ? 'ended' : risky(card) ? 'risky' : 'open')
export const eventOrder = (cards: HomeEventCard[]) =>
  [...cards].sort((a, b) => rankOf(a) - rankOf(b))

// 이번 주 행사: 진행 중이거나 7일 안에 시작하는 행사, 가까운 순
export function weekEvents(events: EventSummary[], today: string) {
  return events
    .filter(event => {
      if (event.status === 'ongoing') return true
      if (event.status !== 'upcoming' || event.startsAt === null) return false
      return daysBetween(today, event.startsAt.slice(0, KOREAN_DATE_LENGTH)) <= WEEK_DAYS
    })
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
}

// 학생회에 진행할 행사(완료하지 않은 행사)가 하나도 없는가. 회장단 홈의 행사 부분(서버 openEventsOf)과 같은 뜻이다.
export const noOpenEvents = (events: EventSummary[]) =>
  events.every(event => event.status === 'completed')

// 낸 날·올린 날(한국 날짜): '10월 20일'
export const createdDay = (iso: string) => monthDay(koreanDay(iso))

// 홈 메시지함의 칩 수(DEC-90, 와이어프레임 HOME-01 메시지함)
const INBOX_LIMIT = 3
// 사람에게 바로 온 방(1:1, 부서 간)은 칩 자리를 먼저 받는다.
export const isPersonalRoom = (room: Pick<RoomSummary, 'type'>) =>
  room.type === 'direct' || room.type === 'inter_department'
// 칩 묶음의 차례: 1:1 → 부서 간 → 나머지(명세 022 정한 것 6)
const INBOX_ORDER = ['direct', 'inter_department'] as const
const inboxRank = (room: RoomSummary) => {
  const rank = INBOX_ORDER.findIndex(type => type === room.type)
  return rank === -1 ? INBOX_ORDER.length : rank
}
const latestFirst = (a: RoomSummary, b: RoomSummary) =>
  (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')

// 메시지함 칩: 안 읽은 1:1, 부서 간 방, 다른 방의 차례로, 묶음마다 최근 순으로 3개(DEC-90).
// 대화 목록과 같은 응답이라 내가 든 방만 있다.
export const inboxRooms = (rooms: RoomSummary[]) =>
  rooms
    .filter(room => room.unread > 0)
    .sort((a, b) => inboxRank(a) - inboxRank(b) || latestFirst(a, b))
    .slice(0, INBOX_LIMIT)
