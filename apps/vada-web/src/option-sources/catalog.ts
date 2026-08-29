// specs/figma/vada-wireframe/option-sources.json 카탈로그의 소비자.
// 계약(요청 시점, 검색 방식, 상태 문구)은 카탈로그를 단일 원본으로 읽고,
// 네트워크만 개발용 mock으로 대체한다(로딩 상태 확인용 인위 지연 포함).
import catalogJson from '../../../../specs/figma/vada-wireframe/option-sources.json'
import {
  COLLEGES,
  DEPARTMENTS,
  BUDGET_ITEMS,
  EVENT_STAFF_CANDIDATES,
  ARCHIVE_REVIEWER_OPTIONS,
  LEDGER_EVENT_OPTIONS,
  LEDGER_MONTH_OPTIONS,
  MEETING_AGENDA_PICKER,
  MESSAGE_ROOM_CATEGORIES,
  SURVEY_COLLEGES,
  SURVEY_DEPARTMENTS,
  ORG_BUDGET_ITEM_OPTIONS,
  ORG_DEPARTMENT_OPTIONS,
  ITEM_CATEGORIES,
  PARTICIPANT_AFFILIATIONS,
  PARTICIPANT_APPLY_STATUS,
  PARTICIPANT_ATTEND_STATUS,
  PARTICIPANT_PAY_STATUS,
  PURCHASE_TYPES,
  REQUEST_PRIORITIES,
  SCHOOLS,
} from './fixtures'

export interface Option {
  value: string
  label: string
  // 라디오 카드처럼 선택지마다 설명이 붙는 표현에서 쓴다.
  description?: string
  disabled?: boolean
  /**
   * 아무것도 고르지 않았을 때 열려 있는 것.
   *
   * **판정은 서버가 한다.** 화면이 '아직 안 끝난 첫째'를 골라 열면 그 규칙이
   * 화면에 박히고, 규칙이 바뀔 때마다 화면을 고쳐야 한다. select.initialValue는
   * 명세가 아는 값일 때의 자리이고, 이것은 그 값이 데이터일 때의 자리다.
   */
  initiallySelected?: boolean
}

export interface SourceMessages {
  idle: string
  loading: string
  empty: string
  error: string
}

export type SearchContract =
  | { mode: 'remote'; queryParam: string; minLength: number; debounceMs: number }
  | { mode: 'client' }

interface RemoteSource {
  key: string
  type: 'remote'
  description: string
  params: string[]
  request: {
    method: 'GET'
    path: string
    loadOn: 'search' | 'open'
    search?: SearchContract
  }
  messages: SourceMessages
}

interface StaticSource {
  key: string
  type: 'static'
  description: string
  params: string[]
  options: Option[]
}

export type OptionSource = RemoteSource | StaticSource

// 카탈로그 드리프트가 조용한 오동작(예: 검색이 영구 idle) 대신 명확한 오류로
// 드러나게 하는 최소 런타임 가드다. 깊은 검증은 검증 CLI가 담당한다.
export function asOptionSourcesCatalog(json: unknown): { sources: OptionSource[] } {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('선택지 카탈로그는 객체여야 합니다.')
  }
  const sources = (json as Record<string, unknown>).sources
  if (!Array.isArray(sources)) {
    throw new Error('선택지 카탈로그에 sources 배열이 필요합니다.')
  }
  for (const source of sources as OptionSource[]) {
    if (typeof source?.key !== 'string' || source.key.length === 0) {
      throw new Error('카탈로그 출처에 key가 필요합니다.')
    }
    if (source.type === 'remote') {
      if (!source.request) {
        throw new Error(`'${source.key}'는 remote이므로 request가 필요합니다.`)
      }
      if (
        source.request.loadOn === 'search' &&
        source.request.search?.mode !== 'remote'
      ) {
        throw new Error(
          `'${source.key}'는 loadOn: search이므로 원격 검색 계약(search.mode: remote)이 필요합니다.`,
        )
      }
    } else if (source.type === 'static') {
      if (!Array.isArray(source.options)) {
        throw new Error(`'${source.key}'는 static이므로 options가 필요합니다.`)
      }
    } else {
      throw new Error(`'${(source as { key: string }).key}'의 type이 올바르지 않습니다.`)
    }
  }
  return { sources: sources as OptionSource[] }
}

const sourceByKey = new Map<string, OptionSource>(
  asOptionSourcesCatalog(catalogJson).sources.map((source) => [source.key, source]),
)

export function getOptionSource(key: string): OptionSource {
  const source = sourceByKey.get(key)
  if (!source) {
    throw new Error(`선택지 출처 '${key}'가 카탈로그에 없습니다.`)
  }
  return source
}

// vada-conventions 7번: mock에 인위 지연을 둬 로딩 상태를 실제로 확인한다.
const MOCK_DELAY_MS = 450

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchOptions(
  key: string,
  params: Record<string, string>,
  query?: string,
): Promise<Option[]> {
  const source = getOptionSource(key)
  if (source.type === 'static') {
    return source.options
  }

  await delay(MOCK_DELAY_MS)

  switch (key) {
    case 'education.schools': {
      const trimmed = (query ?? '').trim()
      return SCHOOLS.filter((option) => option.label.includes(trimmed))
    }
    case 'education.colleges':
      return COLLEGES[params.schoolId] ?? []
    case 'education.departments':
      return DEPARTMENTS[`${params.schoolId}:${params.collegeId}`] ?? []
    case 'event.participantAffiliations':
      return PARTICIPANT_AFFILIATIONS[params.eventId] ?? []
    // 학기는 조직이 언제부터 있었는지에 달렸다. 지금 학기부터 거슬러 온다.
    case 'org.duesTerms':
      return [
        { value: '2026-1', label: '2026년 1학기' },
        { value: '2025-2', label: '2025년 2학기' },
        { value: '2025-1', label: '2025년 1학기' },
      ]
    case 'event.participantApplyStatus':
      return PARTICIPANT_APPLY_STATUS
    case 'event.participantPayStatus':
      return PARTICIPANT_PAY_STATUS
    case 'event.participantAttendStatus':
      return PARTICIPANT_ATTEND_STATUS
    // 셋 다 같은 명단에서 고른다. 자리에 따라 걸러지는 것은 서버가 할 일이다.
    case 'event.staffLeaderCandidates':
    case 'event.staffDeptLeaderCandidates':
    case 'event.staffMemberCandidates':
      return EVENT_STAFF_CANDIDATES[params.eventId] ?? []
    case 'finance.ledgerMonths':
      return LEDGER_MONTH_OPTIONS
    case 'finance.ledgerEvents':
      return LEDGER_EVENT_OPTIONS
    case 'finance.orgBudgetItems':
      return ORG_BUDGET_ITEM_OPTIONS
    // **이 출처는 카탈로그에 있는데 개발용 응답이 없었다.** OPS-MEET-02가 이 select를
    // 펼쳐 그리지 않아 한 번도 열리지 않았고, 그래서 아무도 몰랐다.
    case 'org.departments':
      return ORG_DEPARTMENT_OPTIONS
    case 'record.archiveReviewers':
      return ARCHIVE_REVIEWER_OPTIONS
    case 'survey.colleges':
      return SURVEY_COLLEGES[params.surveyToken] ?? []
    case 'survey.departments':
      return SURVEY_DEPARTMENTS[`${params.surveyToken}:${params.collegeId}`] ?? []
    case 'meeting.agendaPicker':
      return MEETING_AGENDA_PICKER[params.meetingId] ?? []
    case 'message.roomCategories':
      return MESSAGE_ROOM_CATEGORIES
    case 'finance.requestPriorities':
      return REQUEST_PRIORITIES
    case 'finance.itemCategories':
      return ITEM_CATEGORIES
    case 'finance.budgetItems':
      return BUDGET_ITEMS[params.eventId] ?? []
    case 'finance.purchaseTypes':
      return PURCHASE_TYPES
    default:
      throw new Error(`'${key}'의 mock 응답이 없습니다.`)
  }
}
