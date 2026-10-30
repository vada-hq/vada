import { EVENT_APPLICANT_PAGE_SIZE, type DepositStatus, type EventApplicant } from '@vada/contracts'

// 행사 참가자 명단의 거르기·찾기·쪽 넘김·머리 수·줄 차례·확인 필요 까닭(신청자 관리 화면, 10/30 확정 '문서 속 얇은 표 모양').
// 서버는 명단을 한 번에 준다(DEC-93: 서버에서 쪽을 넘기면 쪽마다 열람 기록이 는다). 그래서 거르기를 바꿔도 다시 부르지 않고,
// 머리 수는 늘 받은 명단 전부에서 센다.

type AttendanceFilter = 'attended' | 'absent' | 'none'
export type ApplicantFilter = {
  registration?: 'active' | 'cancelled' | undefined
  deposit?: DepositStatus | undefined
  attendance?: AttendanceFilter | undefined
  needsAttention?: boolean | undefined
  search?: string | undefined
}
export const STATUS_KEYS = ['registration', 'deposit', 'attendance', 'needsAttention'] as const
type StatusKey = (typeof STATUS_KEYS)[number]
export type StatusFilter = Pick<ApplicantFilter, StatusKey>

type QuickKey = 'all' | 'refund' | 'unpaid' | 'attention' | 'attended' | 'absent'
export type Quick = { key: QuickKey; count: number; active: boolean; query: StatusFilter }

const QUICK: Record<QuickKey, StatusFilter> = {
  all: {},
  refund: { deposit: 'refund_pending' },
  unpaid: { deposit: 'none', registration: 'active' },
  attention: { needsAttention: true },
  attended: { attendance: 'attended' },
  absent: { attendance: 'absent' },
}

const attendanceOf = (row: EventApplicant): AttendanceFilter =>
  row.attended ? 'attended' : row.absent ? 'absent' : 'none'
// '입금 안 함'은 받을 돈이 있는 신청만이다. 무료 신청(줄에는 '무료')을 담으면 수와 줄이 어긋난다(Codex 검토).
const owing = (row: EventApplicant) => row.appliedFee > 0

const MATCHES: {
  [K in StatusKey]: (row: EventApplicant, value: NonNullable<ApplicantFilter[K]>) => boolean
} = {
  registration: (row, value) => row.cancelled === (value === 'cancelled'),
  deposit: (row, value) => row.deposit.status === value && (value !== 'none' || owing(row)),
  attendance: (row, value) => attendanceOf(row) === value,
  needsAttention: (row, value) => row.needsAttention === value,
}

// 이름·학번 찾기는 대소문자를 가리지 않는 부분 일치다.
function matchesSearch(row: EventApplicant, search: string | undefined) {
  const needle = search?.trim().toLowerCase()
  if (!needle) return true
  return [row.name, row.studentId ?? ''].some(value => value.toLowerCase().includes(needle))
}

// 상태를 고르지 않은 명단이 '총 N명'이다. 양식 카드의 신청 수와 같게 취소한 신청(환불 대기)은 빼고, 그 줄은 환불 대기에서 본다.
function matchesStatus(row: EventApplicant, filter: StatusFilter) {
  const picked = STATUS_KEYS.filter(key => filter[key] !== undefined)
  if (picked.length === 0) return !row.cancelled
  return picked.every(key =>
    (MATCHES[key] as (row: EventApplicant, value: unknown) => boolean)(row, filter[key]),
  )
}

const filterRows = (rows: EventApplicant[], filter: ApplicantFilter) =>
  rows.filter(row => matchesStatus(row, filter) && matchesSearch(row, filter.search))

export const statusOf = (filter: ApplicantFilter): StatusFilter =>
  Object.fromEntries(
    STATUS_KEYS.flatMap(key => (filter[key] === undefined ? [] : [[key, filter[key]]])),
  )

const sameStatus = (a: StatusFilter, b: StatusFilter) => STATUS_KEYS.every(key => a[key] === b[key])

// 아무 거르기도 찾기도 없다(빈 명단의 글을 '신청자 없음'으로 한다).
export const isWhole = (filter: ApplicantFilter) =>
  Object.keys(statusOf(filter)).length === 0 && !filter.search?.trim()

// 0명인 거르기는 숨긴다. 고른 거르기와 '전체'는 늘 보인다.
export function quickFilters(rows: EventApplicant[], filter: ApplicantFilter): Quick[] {
  const status = statusOf(filter)
  return (Object.keys(QUICK) as QuickKey[])
    .map(key => ({
      key,
      active: sameStatus(status, QUICK[key]),
      query: QUICK[key],
      count: filterRows(rows, { ...QUICK[key], search: filter.search }).length,
    }))
    .filter(quick => quick.key === 'all' || quick.active || quick.count > 0)
}

// 확인 필요 줄을 맨 위로 모은다(받은 차례 안에서 안정 정렬). 명단 전부를 정렬한 뒤 쪽을 나눠, 확인 필요가 첫 쪽부터 모인다.
const attentionFirst = (rows: EventApplicant[]) =>
  rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => Number(b.row.needsAttention) - Number(a.row.needsAttention) || a.i - b.i)
    .map(item => item.row)

const pageCountOf = (count: number) => Math.max(1, Math.ceil(count / EVENT_APPLICANT_PAGE_SIZE))
// 쪽 번호는 1부터다. 거르기로 줄이 줄어 쪽이 사라졌으면 마지막 쪽을 보인다.
function pageOf<T>(rows: T[], page: number) {
  const last = pageCountOf(rows.length)
  const shown = Math.min(Math.max(1, page), last)
  const start = (shown - 1) * EVENT_APPLICANT_PAGE_SIZE
  return { page: shown, pages: last, rows: rows.slice(start, start + EVENT_APPLICANT_PAGE_SIZE) }
}

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

// 행사 첫날(한국 날짜)부터 [불참 처리]를 보인다. 그 전이나 일시가 없으면 아직 올지 모른다.
export const eventStarted = (startsAt: string | null, today: string) =>
  startsAt !== null && today >= startsAt.slice(0, today.length)

// 지금 쪽에 보일 줄: 거르고 찾은 뒤 확인 필요를 위로 모으고 50줄씩 나눈다. count는 거른 뒤 전체 수다.
export function visibleOf(rows: EventApplicant[], filter: ApplicantFilter, page: number) {
  const filtered = attentionFirst(filterRows(rows, filter))
  return { ...pageOf(filtered, page), count: filtered.length }
}
