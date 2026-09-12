// 선택지 조회. definitions.ts의 명세에 따라 정적 목록·서버·개발용 응답을 선택한다.
import { getOptionSource, type Option, type RemoteSource } from './definitions'
import { currentServer, urlOf } from '../data-sources/server'
import { NotBuiltYet } from '../data-sources/server'
import { isServed } from '../data-sources/served'
import {
  COLLEGES,
  DEPARTMENTS,
  BUDGET_ITEMS,
  EVENT_STAFF_CANDIDATES,
  ARCHIVE_REVIEWER_OPTIONS,
  BUDGET_EVENT_OPTIONS,
  LEDGER_EVENT_OPTIONS,
  LEDGER_MONTH_OPTIONS,
  MEETING_AGENDA_PICKER,
  MESSAGE_ROOM_CATEGORIES,
  SURVEY_COLLEGES,
  SURVEY_DEPARTMENTS,
  ORG_BUDGET_ITEM_OPTIONS,
  ORG_DEPARTMENT_OPTIONS,
  PARTICIPANT_AFFILIATIONS,
  PARTICIPANT_APPLY_STATUS,
  PARTICIPANT_ATTEND_STATUS,
  PARTICIPANT_PAY_STATUS,
  SCHOOLS,
} from './fixtures'

// vada-conventions 7번: mock에 인위 지연을 둬 로딩 상태를 실제로 확인한다.
const MOCK_DELAY_MS = 450

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 목록을 서버에서 받는다.
 *
 * **검색어는 계약이 이름을 정한다**(`search.queryParam`). 화면이 `q`라고 지어내면
 * 그 이름이 서버와 어긋나는 순간 목록이 통째로 비는데, 빈 목록은 '찾은 것이 없다'와
 * 구분되지 않아 조용하다.
 *
 * **실패하면 던진다.** 개발용 응답으로 슬쩍 돌아가면 서버가 죽어도 화면은 멀쩡히
 * 목록을 그리고, 사람은 없는 학교를 고른다. 부르는 쪽(`useOptions`)이 그 오류를
 * 받아 카탈로그의 글을 그린다.
 */
async function fromServerOptions(
  source: RemoteSource,
  params: Record<string, string>,
  query: string | undefined,
): Promise<Option[]> {
  const at = currentServer()!
  const search = source.request.search
  const asked =
    search?.mode === 'remote' && query !== undefined
      ? { ...params, [search.queryParam]: query }
      : params
  const res = await at.fetch(`${at.baseUrl ?? ''}${urlOf(source.request.path, asked)}`)
  if (!res.ok) {
    throw new Error(`선택지 출처 '${source.key}'를 받지 못했습니다(${res.status}).`)
  }
  return (await res.json()) as Option[]
}

export async function fetchOptions(
  key: string,
  params: Record<string, string>,
  query?: string,
): Promise<Option[]> {
  const source = getOptionSource(key)

  // 열쇠 없이 물으면 무엇의 선택지인지 알 수 없다. '선택한 학교의 단과대학'을
  // 학교 없이 부르면 어느 학교의 것도 아닌 목록이 온다.
  for (const param of source.params) {
    if (param.required && params[param.key] === undefined) {
      throw new Error(
        `선택지 출처 '${key}'는 조회 인자 '${param.key}'를 반드시 받습니다(${param.description}).`,
      )
    }
  }

  // **명세가 값을 들고 있는 목록은 서버를 부르지 않는다.** 학년·학생회 유형처럼
  // 값이 계약 안에 박힌 것들이라(`static`) OpenAPI에 자리조차 생기지 않는다.
  if (source.type === 'static') {
    return source.options
  }

  // **진짜 서버에 붙은 목록은 서버에서 온다.** 데이터 출처와 같은 서버, 같은
  // 주소 규칙을 쓴다 — 두 벌을 두면 하나만 켜진 상태가 생기고, 그러면 같은 화면의
  // 표는 진짜인데 고르는 목록은 개발용 응답인 채로 그려진다.
  if (currentServer() !== null) {
    // **안 붙은 목록도 개발용 응답으로 돌아가지 않는다.** 표는 진짜인데 고를 것이
    // 가짜면 사람은 없는 학교를 고르고 저장할 때 터진다 — 읽는 자리와 같은 규칙이다.
    if (!isServed(key)) throw new NotBuiltYet(key)
    return fromServerOptions(source, params, query)
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
    case 'finance.budgetEvents':
      return BUDGET_EVENT_OPTIONS
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
    case 'finance.budgetItems':
      return BUDGET_ITEMS[params.eventId] ?? []
    default:
      throw new Error(`'${key}'의 mock 응답이 없습니다.`)
  }
}
