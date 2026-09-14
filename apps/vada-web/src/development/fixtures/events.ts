import type { DataRow } from '../../data-sources/definitions'
import {
  EVENT_BASICS_DRAFT,
  EVENT_COMPLETE_CONFIRM,
  EVENT_END_PERMISSION,
  EVENT_STAFF_DEPARTMENTS,
  EVENT_STAFF_LEADERS,
  EVENT_STAFF_SETUP_PREVIEW,
  EVENT_STAFF_UNASSIGNED,
} from './event-administration-data'
import {
  EVENT_CHECKLIST,
  EVENT_DOCUMENTS,
  EVENT_DOCUMENT_STATS,
  EVENT_FINANCE_ALERTS,
  EVENT_FINANCE_BOARD,
  EVENT_FINANCE_SUMMARY,
  EVENT_LIST,
  EVENT_MEETINGS,
  EVENT_MEETING_COUNTS,
  EVENT_OVERVIEW,
  EVENT_PARTICIPANTS,
  EVENT_RECENT_CHANGES,
  EVENT_SCHEDULE,
  EVENT_SUMMARIES,
  EVENT_TASK_BOARD,
  EVENT_WORKSPACES,
  EVENT_WRAP_UP_BANNER,
  EVENT_WRAP_UP_COUNTS,
  EVENT_WRAP_UP_REMAINING,
  PARTICIPANT_PAGE_SIZE,
} from './event-state'
import { matchesQuery } from './search'
import { VIEWER_NAME, createTaskFilteredFixtures } from './tasks'

export const EVENT_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 행사 목록을 보는 사람. 지금 보는 사람은 새 행사를 만들 수 없다 - 만들 수 있는
  // 사람이 보는 그림이 EVT-00A2(변형)이고, 사람이 그 사이를 오갈 수 없다.
  'event.listViewer': { canCreateEvent: false },
}

export const EVENT_TASK_FILTERED_FIXTURES = createTaskFilteredFixtures(EVENT_TASK_BOARD)

function overview(eventId: string, part: string): DataRow[] {
  const row = EVENT_OVERVIEW[eventId]?.[part]
  return row === undefined ? [] : [row]
}

// 거르기는 서버가 한다 — 화면은 받아온 것을 다시 자르지 않는다.
function filterParticipants(params: Record<string, string>): DataRow[] {
  const {
    eventId = '',
    query = '',
    affiliation = '',
    applyStatus = '',
    payStatus = '',
    attendStatus = '',
  } = params
  return EVENT_PARTICIPANTS.filter((entry) => entry.eventId === eventId)
    .map((entry) => entry.row)
    .filter(
      (row) =>
        query === '' ||
        String(row.name).includes(query) ||
        String(row.studentNo).includes(query),
    )
    .filter((row) => affiliation === '' || row.affiliation === affiliation)
    .filter((row) => applyStatus === '' || row.applyStatus === applyStatus)
    .filter((row) => payStatus === '' || row.payStatus === payStatus)
    .filter((row) => attendStatus === '' || row.attendStatus === attendStatus)
}

export const EVENT_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 진행 단계는 '전체'가 아니면 그 단계만 남긴다. 검색은 행사 이름·장소·담당을 본다.
  'event.list': ({ query = '', status = 'all' }) =>
    EVENT_LIST.filter((event) => status === 'all' || event.status === status)
      .map((event) => event.row)
      .filter((row) => matchesQuery(row, query)),
  // 상세는 목록이 아니지만 인자를 받으므로 같은 자리를 쓴다 — 한 건을 담은
  // 배열로 오고, readObjectSource가 첫 줄을 집는다.
  'event.overviewBriefing': ({ eventId = '' }) => overview(eventId, 'briefing'),
  'event.overviewHighlights': ({ eventId = '' }) => overview(eventId, 'highlights'),
  'event.basics': ({ eventId = '' }) => overview(eventId, 'basics'),
  'event.recruitSettings': ({ eventId = '' }) => overview(eventId, 'recruitSettings'),
  'event.participantStats': ({ eventId = '' }) => overview(eventId, 'participantStats'),
  'event.checklist': ({ eventId = '' }) => EVENT_CHECKLIST[eventId] ?? [],
  'event.recentChanges': ({ eventId = '' }) => EVENT_RECENT_CHANGES[eventId] ?? [],
  'event.documentStats': ({ eventId = '' }) =>
    EVENT_DOCUMENT_STATS[eventId] ? [EVENT_DOCUMENT_STATS[eventId]] : [],
  // 개수는 고른 상태와 무관하게 이 행사의 문서 전체를 센다 — 거른 뒤에 세면
  // 고르는 순간 나머지 선택지의 개수가 0이 된다.
  'event.documentStatusCounts': ({ eventId = '' }) => {
    const rows = EVENT_DOCUMENTS.filter((document) => document.eventId === eventId)
    if (rows.length === 0) return []
    const count = (status: string) => rows.filter((row) => row.status === status).length
    return [
      {
        all: rows.length,
        drafting: count('drafting'),
        reviewing: count('reviewing'),
        confirmed: count('confirmed'),
        notStarted: count('notStarted'),
      },
    ]
  },
  'event.documents': ({ eventId = '', status = 'all' }) =>
    EVENT_DOCUMENTS.filter(
      (document) =>
        document.eventId === eventId && (status === 'all' || document.status === status),
    ).map((document) => document.row),
  'event.meetings': ({ eventId = '' }) =>
    EVENT_MEETINGS.filter((meeting) => meeting.eventId === eventId).map(
      (meeting) => meeting.row,
    ),
  'event.schedule': ({ eventId = '', filter = 'all' }) =>
    EVENT_SCHEDULE.filter(
      (entry) =>
        entry.eventId === eventId && (filter === 'all' || entry.buckets.includes(filter)),
    ).map((entry) => entry.row),
  'event.participants': (params) => {
    const rows = filterParticipants(params)
    const page = Math.max(1, Number(params.page ?? '1') || 1)
    return rows.slice((page - 1) * PARTICIPANT_PAGE_SIZE, page * PARTICIPANT_PAGE_SIZE)
  },
  // 총 몇 명인지·몇 쪽인지는 목록이 말할 수 없다 — 한 쪽만큼만 받아 오기 때문이다.
  'event.participantPaging': (params) => {
    if ((params.eventId ?? '') === '') return []
    const total = filterParticipants(params).length
    return [
      {
        totalNote: `총 ${total}명`,
        pageCount: Math.max(1, Math.ceil(total / PARTICIPANT_PAGE_SIZE)),
      },
    ]
  },
  'event.financeSummary': ({ eventId = '' }) =>
    EVENT_FINANCE_SUMMARY[eventId] ? [EVENT_FINANCE_SUMMARY[eventId]] : [],
  'event.financeAlerts': ({ eventId = '' }) =>
    EVENT_FINANCE_ALERTS[eventId] ? [EVENT_FINANCE_ALERTS[eventId]] : [],
  'event.financeBoard': ({ eventId = '', stage = '' }) =>
    EVENT_FINANCE_BOARD.filter(
      (entry) => entry.eventId === eventId && entry.stage === stage,
    ).map((entry) => entry.row),
  'event.meetingCounts': ({ eventId = '' }) =>
    EVENT_MEETING_COUNTS[eventId] ? [EVENT_MEETING_COUNTS[eventId]] : [],
  'event.workspace': ({ eventId = '' }) =>
    EVENT_WORKSPACES[eventId] ? [EVENT_WORKSPACES[eventId]] : [],
  'event.summary': ({ eventId = '' }) =>
    EVENT_SUMMARIES[eventId] ? [EVENT_SUMMARIES[eventId]] : [],
  'event.wrapUpBanner': ({ eventId = '' }) => {
    const row = EVENT_WRAP_UP_BANNER[eventId]
    return row === undefined ? [] : [row]
  },
  'event.wrapUpCounts': ({ eventId = '' }) => {
    const row = EVENT_WRAP_UP_COUNTS[eventId]
    return row === undefined ? [] : [row]
  },
  'event.wrapUpRemaining': ({ eventId = '' }) => EVENT_WRAP_UP_REMAINING[eventId] ?? [],
  // 인자가 가리키는 행사가 없으면 빈 목록이고, 그것은 '개발용 응답이 없다'가
  // 아니라 **찾지 못했다**다(readDataSource가 NOT_FOUND로 가른다).
  'event.endPermission': ({ eventId = '' }) => {
    const row = EVENT_END_PERMISSION[eventId]
    return row === undefined ? [] : [row]
  },
  'event.completeConfirm': ({ eventId = '' }) => {
    const row = EVENT_COMPLETE_CONFIRM[eventId]
    return row === undefined ? [] : [row]
  },
  'event.staffLeaders': ({ eventId = '' }) => EVENT_STAFF_LEADERS[eventId] ?? [],
  'event.staffDepartments': ({ eventId = '' }) => EVENT_STAFF_DEPARTMENTS[eventId] ?? [],
  // 세울 조직은 행사가 아니라 **고른 방식**이 정한다.
  'event.staffSetupPreview': ({ setupMode = '' }) =>
    EVENT_STAFF_SETUP_PREVIEW[setupMode] ?? [],
  'event.staffUnassignedMembers': ({ eventId = '' }) => EVENT_STAFF_UNASSIGNED[eventId] ?? [],
  'event.basicsDraft': ({ eventId = '' }) => {
    const row = EVENT_BASICS_DRAFT[eventId]
    return row === undefined ? [] : [row]
  },
  // 건수는 보는 범위와 무관하게 이 행사의 보드 전체를 센다.
  'event.taskAlerts': ({ eventId = '' }) => {
    const rows = EVENT_TASK_BOARD.filter((task) => task.eventId === eventId)
    if (rows.length === 0) return []
    return [
      {
        delayedCount: rows.filter((task) => task.row.alert === '지연').length,
        reviewCount: rows.filter((task) => task.row.alert === '검토 필요').length,
        mineCount: rows.filter((task) => task.row.assignee === VIEWER_NAME).length,
        unassignedCount: rows.filter((task) => task.row.tone !== task.row.departmentTone)
          .length,
      },
    ]
  },
  'event.taskBoard': ({ eventId = '', scope = 'all', status = 'planned' }) =>
    EVENT_TASK_BOARD.filter(
      (task) => task.eventId === eventId && task.status === status,
    )
      .filter((task) => scope !== 'mine' || task.row.assignee === VIEWER_NAME)
      .map((task) => task.row),
}
