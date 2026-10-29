import {
  koreanYearOf,
  type RecordEventChips,
  type RecordEventItem,
  type RecordTimelineKind,
} from '@vada/contracts'
import { dayLabel } from '@/lib/korean-date-text'
import { whenLabel } from '../events/event-view'

// 기록 메뉴(DEC-110, 기능 030)의 글. 숫자와 비율은 서버가 센 값을 그대로 쓴다(다시 계산하지 않는다).

// 카드의 성과 칩 셋(REC-01 '성과 요약'). 예산이 0이면 집행률이 없어(null) '예산 없음'이다.
export const attendanceChip = (chips: RecordEventChips) =>
  `참석 ${chips.attended}명 (신청 ${chips.applied}명)`
export const executionChip = (chips: RecordEventChips) =>
  chips.executionRate === null ? '예산 없음' : `예산 집행 ${chips.executionRate}%`
export const tasksChip = (chips: RecordEventChips) => `완료 업무 ${chips.tasksDone}건`

// now는 올해 판단용이다(부품 확인 화면이 고정한다).
export const completedLabel = (completedAt: string, now?: Date) =>
  `완료 처리 ${dayLabel(completedAt, now)}`

// 행사 일시. 기록은 지난 행사가 많아 올해가 아니면 앞에 연도를 붙인다(AGENTS.md 날짜 꼴).
export function recordWhen(event: Pick<RecordEventItem, 'startsAt' | 'endsAt'>, now = new Date()) {
  const label = whenLabel(event)
  const [year] = event.startsAt?.split('-') ?? []
  return year === undefined || year === koreanYearOf(now) ? label : `${year}년 ${label}`
}

// 정렬: 완료 처리일순(기본, 서버 차례 그대로)과 행사 일시순(최근 행사부터, 일시 미정은 끝).
export type RecordOrder = 'completed' | 'date'
export const RECORD_ORDERS: { value: RecordOrder; label: string }[] = [
  { value: 'completed', label: '완료 처리일순' },
  { value: 'date', label: '행사 일시순' },
]

export function visibleRecords(events: RecordEventItem[], query: string, order: RecordOrder) {
  const needle = query.trim().toLocaleLowerCase('ko')
  const found = events.filter(event => event.name.toLocaleLowerCase('ko').includes(needle))
  if (order === 'completed') return found
  // 일시는 한국 시각 'YYYY-MM-DDTHH:mm'이라 글자 차례가 시간 차례다.
  return found.sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))
}

// 행사 기록 상세의 대목. 목차와 본문이 이 차례를 같이 쓴다. 나중에 붙일 살(현장 운영·회고·인수인계)은 여기에 더한다.
export const RECORD_SECTIONS = [
  { id: 'overview', label: '개요' },
  { id: 'outcome', label: '성과' },
  { id: 'timeline', label: '타임라인' },
  { id: 'sources', label: '근거 자료' },
] as const
export type RecordSectionId = (typeof RECORD_SECTIONS)[number]['id']

// 타임라인 줄 앞에 붙는 종류 이름. 서버 글이 이미 무엇인지 말하는 종류(만듦, 변경, 완료)는 붙이지 않는다.
// 모르는 종류(나중에 더한 것)는 글만 보인다.
export const TIMELINE_PREFIX: Partial<Record<RecordTimelineKind, string>> = { meeting: '회의' }

export const RECORD_TEXT = {
  loading: '완료된 행사 불러오는 중…',
  loadingOne: '행사 기록 불러오는 중…',
  failed: '완료된 행사를 불러오지 못했어요. 연결을 확인해 주세요.',
  failedOne: '행사 기록을 불러오지 못했어요. 연결을 확인해 주세요.',
  lost: '완료한 행사가 아니거나 찾을 수 없어요.',
  empty: '완료된 행사 없음',
  noMatch: '결과 없음',
} as const
