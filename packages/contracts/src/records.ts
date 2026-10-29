import type { EventSummary } from './events.js'
import { menuPath, recordPath } from './paths.js'

// 기록 메뉴(DEC-110, 기능 030)의 응답. 완료한 행사의 숫자는 쌓인 기록에서 열 때마다 서버가 센다. 사람이 쓰는 칸은 없다.
// 대목(overview, outcome, timeline, sources)마다 칸을 더하기만으로 늘린다. 현장 운영·회고·인수인계는 나중에 붙일 살이다.
// 비율은 서버가 정수 퍼센트(반올림)로 준다. 분모가 0이면 null이다. 화면은 다시 계산하지 않는다.
// 신청자 개인정보(이름·학번·휴대폰)는 싣지 않는다. 사람은 운영진의 표시 이름만이다.

type RecordPerson = { id: string; name: string }

// 목록 카드의 성과 칩 셋: 참석 N명(신청 M명), 예산 집행 N%, 완료 업무 N건.
export interface RecordEventChips {
  // 취소하지 않은 신청의 취소하지 않은 출석 수(신청 양식의 attendedCount와 같은 셈)
  attended: number
  // 취소한 신청을 뺀 신청 수
  applied: number
  // 원(정수). 정산 탭의 예산 지출과 실제 지출과 같은 셈이다.
  budget: number
  actual: number
  // actual ÷ budget(%). 예산이 0이면 null이다.
  executionRate: number | null
  // 취소하지 않은 업무 가운데 끝난 수
  tasksDone: number
}

export interface RecordEventItem extends Pick<
  EventSummary,
  'id' | 'name' | 'startsAt' | 'endsAt' | 'owner'
> {
  // 이 행사에 이은 취소하지 않은 업무(끝난 것 포함)를 맡은 부서 이름, 중복 없이 이름순이다.
  departments: string[]
  // 완료 처리 시각(ISO). 마지막 완료 결재의 시각이다.
  completedAt: string
  chips: RecordEventChips
}

// 완료한 행사 목록. 완료 처리가 최근인 것부터 EVENT_LIST_LIMIT개까지이고, 넘으면 truncated다. 완료를 취소한 행사는 없다.
export interface RecordEventsResponse {
  events: RecordEventItem[]
  truncated: boolean
}

export interface EventRecordOverview extends Pick<
  EventSummary,
  'id' | 'name' | 'startsAt' | 'endsAt' | 'place' | 'owner'
> {
  departments: string[]
  completedAt: string
  completedBy: RecordPerson | null
}

export interface EventRecordOutcome {
  // total은 취소한 것까지 모든 신청이다. 출석률은 출석 ÷ (신청 − 취소)(%), 분모가 0이면 null이다.
  registrations: { total: number; cancelled: number; attended: number; rate: number | null }
  // 정산 탭과 같은 셈이다. difference = budget − actual, 집행률은 actual ÷ budget(%), 예산이 0이면 null이다.
  money: { budget: number; actual: number; difference: number; rate: number | null }
  // 취소하지 않은 업무
  tasks: { done: number; total: number }
}

// 타임라인 줄의 종류. 나중에 종류를 더하기만 한다(결정, 구매 승인 등). 화면은 모르는 종류를 글만으로 보인다.
export const RECORD_TIMELINE_KINDS = [
  'created',
  'changed',
  'meeting',
  'completed',
  'completion_cancelled',
] as const
export type RecordTimelineKind = (typeof RECORD_TIMELINE_KINDS)[number]

// 시각(ISO)순, 같으면 RECORD_TIMELINE_KINDS 차례다(완료·완료 취소끼리는 결재 차례). recordId는 줄이 가리키는 기록(회의)이고, 없으면 null이다.
export interface RecordTimelineEntry {
  kind: RecordTimelineKind
  at: string
  text: string
  by: RecordPerson | null
  recordId: string | null
}

// 근거 자료의 수. 화면이 행사 화면의 탭(업무, 회의, 구매)으로 잇는다. 취소한 것은 세지 않는다.
export interface EventRecordSources {
  tasks: number
  meetings: number
  purchases: number
}

export interface EventRecord {
  overview: EventRecordOverview
  outcome: EventRecordOutcome
  timeline: RecordTimelineEntry[]
  sources: EventRecordSources
}

export interface EventRecordResponse {
  record: EventRecord
}

// 기록 메뉴의 주소. 목록은 /records/<학생회>, 행사 기록은 /records/<학생회>/<행사>다(메뉴·기록 주소, paths.ts).
export const recordsPath = (councilId: string) => menuPath('records', councilId)
export const eventRecordPath = (councilId: string, eventId: string) =>
  recordPath('records', councilId, eventId)
