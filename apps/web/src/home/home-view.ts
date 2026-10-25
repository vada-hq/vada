import {
  KOREAN_DATE_LENGTH,
  koreanOf,
  type EventSummary,
  type HomeEventCard,
  type HomeList,
  type HomeMine,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import { monthDay } from '@/lib/korean-date-text'

// 새로 더한 부분(내 요청, 이번 주 행사)은 앞의 몇 줄만 보이고 나머지는 원래 화면으로 넘긴다.
export const SHORT_LIST = 3
// 이번 주 행사: 오늘부터 이 날수 안에 시작하는 행사
const WEEK_DAYS = 7
// 반려·일부 승인된 내 요청은 낸 지 이 날수 안의 것만 홈에 둔다(오래된 것은 재정 화면에서 본다).
const SETTLED_REQUEST_DAYS = 14
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

// 내 요청 중 아직 볼 것: 반려·일부 승인(다시 낼지 내가 정한다)을 먼저, 그다음 결재 대기를 오래된 순
export function openRequests(requests: PurchaseRequestSummary[], today: string) {
  const answered = requests.filter(
    request =>
      (request.status === 'rejected' || request.status === 'partial') &&
      daysBetween(koreanDay(request.createdAt), today) <= SETTLED_REQUEST_DAYS,
  )
  const waiting = requests
    .filter(request => request.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return [...answered, ...waiting]
}

// 낸 날·올린 날(한국 날짜): '10월 20일'
export const createdDay = (iso: string) => monthDay(koreanDay(iso))
