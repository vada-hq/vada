import type { EventApplicant, EventApplicantsQuery, EventApplicantsResponse } from '@vada/contracts'

// 행사 참가자 명단의 머리 수·빠른 거르기·줄 차례·확인 필요 까닭(신청자 관리 화면, 10/30 확정 '문서 속 얇은 표 모양').
// 서버는 거른 결과를 50줄씩 준다(total = 거른 뒤 수). 웹은 받은 줄만 센다: 거르지 않은 명단이 한 쪽에 다 들어왔을 때만
// 상태별 수를 적고, 아니면 수를 비운다(모르는 수를 지어내지 않는다). 고른 거르기의 수는 서버 total이라 늘 맞다.

type Query = Partial<EventApplicantsQuery>
export const STATUS_KEYS = ['registration', 'deposit', 'attendance', 'needsAttention'] as const
type StatusKey = (typeof STATUS_KEYS)[number]
export type StatusQuery = Pick<Query, StatusKey>

type QuickKey = 'all' | 'unpaid' | 'attention' | 'attended' | 'notAttended'
export type Quick = { key: QuickKey; count: number | null; active: boolean; query: StatusQuery }

const QUICK: Record<QuickKey, StatusQuery> = {
  all: {},
  unpaid: { deposit: 'none', registration: 'active' },
  attention: { needsAttention: true },
  attended: { attendance: 'attended' },
  notAttended: { attendance: 'not_attended', registration: 'active' },
}

// 서버 거르기와 같은 규칙으로 센다(event-applicant-rows.ts filtersOf).
const COUNT: Record<Exclude<QuickKey, 'all'>, (row: EventApplicant) => boolean> = {
  unpaid: row => row.deposit.status === 'none' && !row.cancelled,
  attention: row => row.needsAttention,
  attended: row => row.attended,
  notAttended: row => !row.attended && !row.cancelled,
}

export const statusOf = (query: Query): StatusQuery =>
  Object.fromEntries(
    STATUS_KEYS.flatMap(key => (query[key] === undefined ? [] : [[key, query[key]]])),
  )

const sameStatus = (a: StatusQuery, b: StatusQuery) => STATUS_KEYS.every(key => a[key] === b[key])

// 거르지 않은 명단 전부가 이 쪽에 있다.
export const isWhole = (data: EventApplicantsResponse, query: Query) =>
  Object.keys(statusOf(query)).length === 0 &&
  !query.search &&
  data.page === 1 &&
  data.total === data.applicants.length

// 받을 돈이 있는 사람이 없으면(무료 행사) '입금 안 함'은 뜻이 없다.
const owes = (rows: EventApplicant[]) => rows.some(row => COUNT.unpaid(row) && row.appliedFee > 0)

function countOf(key: QuickKey, data: EventApplicantsResponse, whole: boolean, active: boolean) {
  if (active) return data.total
  if (!whole) return null
  return key === 'all' ? data.total : data.applicants.filter(COUNT[key]).length
}

// 0명으로 아는 거르기는 숨긴다. 참석·불참은 출석이 하나라도 생긴 뒤에만 뜻이 있다(행사 전에는 모두 기록 없음).
function shown(quick: Quick, data: EventApplicantsResponse, whole: boolean) {
  if (quick.key === 'all' || quick.active) return true
  if (quick.count === 0) return false
  if (quick.key === 'unpaid') return !whole || owes(data.applicants)
  if (quick.key === 'attended' || quick.key === 'notAttended') return data.counts.attended > 0
  return true
}

export function quickFilters(data: EventApplicantsResponse, query: Query): Quick[] {
  const whole = isWhole(data, query)
  const status = statusOf(query)
  return (Object.keys(QUICK) as QuickKey[])
    .map(key => {
      const active = sameStatus(status, QUICK[key])
      return { key, active, query: QUICK[key], count: countOf(key, data, whole, active) }
    })
    .filter(quick => shown(quick, data, whole))
}

// 확인 필요 줄을 맨 위로 모은다(받은 차례 안에서 안정 정렬). 머리 '확인 필요 N'을 읽은 눈이 바로 아래로 이어지고 같은 학번 짝이 붙어 선다.
// 서버는 신청 차례로 쪽을 나누므로 여러 쪽이면 그 쪽 안에서만 모인다(그때는 '확인 필요' 거르기가 전부를 모은다).
export const attentionFirst = (rows: EventApplicant[]) =>
  rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => Number(b.row.needsAttention) - Number(a.row.needsAttention) || a.i - b.i)
    .map(item => item.row)

// 확인 필요 까닭: 서버가 준 사실(같은 학번, 환불 대기)만 글로 쓴다. 같은 학번 상대는 받은 줄에서 찾는다(취소하지 않은 다른 신청).
// 마감 뒤 입금 안 함은 서버가 까닭을 따로 주지 않아 글 없이 표시만 한다(입금 칸이 '입금 안 함'을 보인다).
export function reasonOf(row: EventApplicant, rows: EventApplicant[]) {
  if (!row.needsAttention) return null
  if (row.duplicateStudentId && row.studentId) {
    const mates = rows
      .filter(other => other.id !== row.id && !other.cancelled && other.studentId === row.studentId)
      .map(other => other.name)
    return mates.length ? `같은 학번 · ${mates.join(', ')}` : '같은 학번'
  }
  return row.deposit.status === 'refund_pending' ? '환불 대기' : null
}

// 행사 첫날(한국 날짜)부터 출석 기록 없음을 '불참'이라 한다. 그 전이나 일시가 없으면 아직 모른다.
export const eventStarted = (startsAt: string | null, today: string) =>
  startsAt !== null && today >= startsAt.slice(0, today.length)
