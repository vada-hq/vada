import type { Option } from '../option-sources/definitions'
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
} from './option-fixtures'

// vada-conventions 7번: mock에 인위 지연을 둬 로딩 상태를 실제로 확인한다.
const MOCK_DELAY_MS = 450

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function readDevelopmentOptions(
  key: string,
  params: Record<string, string>,
  query?: string,
): Promise<Option[]> {
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
