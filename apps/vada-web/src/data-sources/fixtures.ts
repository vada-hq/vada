// 개발용 응답. 값은 figma.design.json이 그린 예시를 그대로 옮긴 것이라
// 구현 화면과 reference.png를 눈으로 대조할 수 있다. 백엔드가 붙으면
// catalog.ts의 request.path로 대체된다.
import type { DataRow } from './catalog'

const MY_TASKS: Array<{ tab: string; row: DataRow }> = [
  {
    tab: 'todo',
    row: {
      title: '행사 안전 안내문 검토',
      department: '기획부',
      status: '검토 필요',
      nextAction: '검토 의견을 확인하고 처리 내용을 기록',
      context: '2026 소프트웨어융합대학 체육대회',
      date: '07.22',
      linkedDocument: '행사 안전 안내문 검토 관련 문서',
    },
  },
  {
    tab: 'todo',
    row: {
      title: '학생 건의 답변 문안 검토',
      department: '기획부',
      status: '검토 필요',
      nextAction: '검토 의견을 확인하고 처리 내용을 기록',
      context: '상시 업무',
      date: '07.22',
    },
  },
  {
    tab: 'inProgress',
    row: {
      title: '참가자 모집 공지 작성',
      department: '홍보부',
      status: '진행 중',
      nextAction: '공지 문안을 작성하고 검토를 요청',
      context: '2026 소프트웨어융합대학 체육대회',
      date: '07.20',
    },
  },
  {
    tab: 'inProgress',
    row: {
      title: '주간 운영회의 자료 준비',
      department: '운영부',
      status: '진행 중',
      nextAction: '지난 회의 결정 사항을 정리',
      context: '상시 업무',
      date: '07.21',
    },
  },
]

// 탭 배지는 목록에서 센다. 따로 적어 두면 목록과 어긋날 수 있다.
function countByTab(): DataRow {
  const counts: DataRow = { todo: 0, inProgress: 0, done: 0 }
  for (const task of MY_TASKS) {
    counts[task.tab] = Number(counts[task.tab] ?? 0) + 1
  }
  return counts
}

// 상시 업무 보드(TASK-01). 값은 디자인이 그린 예시를 그대로 옮긴 것이다.
// 건수는 이 목록에서 세므로 칩·열 머리와 목록이 어긋날 수 없다.
const TASK_BOARD: Array<{ status: string; row: DataRow }> = [
  {
    status: 'planned',
    row: {
      title: '동아리방·물품 정기 점검',
      department: '운영부',
      departmentTone: 'teal',
      tone: 'red',
      cycle: '매월',
      assignee: '담당자 없음 · 배정 필요',
      dueDate: '2026-08-01',
    },
  },
  {
    status: 'planned',
    row: {
      title: '게시판 공지물 정리',
      department: '홍보부',
      departmentTone: 'pink',
      tone: 'pink',
      cycle: '매월',
      assignee: '이윤슬',
      dueDate: '2026-07-31',
    },
  },
  {
    status: 'inProgress',
    row: {
      title: '주간 운영회의 자료 준비',
      department: '운영부',
      departmentTone: 'teal',
      tone: 'teal',
      cycle: '매주',
      assignee: '박해랑',
      dueDate: '2026-07-21',
    },
  },
  {
    status: 'inProgress',
    row: {
      title: '회계 장부 주간 정리',
      department: '재정부',
      departmentTone: 'emerald',
      tone: 'emerald',
      cycle: '매주',
      assignee: '김민준',
      dueDate: '2026-07-22',
    },
  },
  {
    status: 'inProgress',
    row: {
      title: 'SNS 계정 운영·공지 게시',
      department: '홍보부',
      departmentTone: 'pink',
      tone: 'pink',
      cycle: '상시',
      assignee: '이윤슬',
      dueDate: '상시',
    },
  },
  {
    status: 'inProgress',
    row: {
      title: '학생 건의함 확인·답변',
      department: '기획부',
      departmentTone: 'violet',
      tone: 'violet',
      cycle: '매주',
      assignee: '이수현',
      dueDate: '2026-07-18',
      alert: '지연',
      alertTone: 'red',
    },
  },
  {
    status: 'review',
    row: {
      title: '학생 건의 답변 문안 검토',
      department: '기획부',
      departmentTone: 'violet',
      tone: 'violet',
      cycle: '매주',
      assignee: '박해랑',
      dueDate: '2026-07-22',
      alert: '검토 필요',
      alertTone: 'yellow',
    },
  },
  {
    status: 'done',
    row: {
      title: '회의실 예약 현황 관리',
      department: '운영부',
      departmentTone: 'teal',
      tone: 'teal',
      cycle: '매주',
      assignee: '정하늘',
      dueDate: '2026-07-15',
    },
  },
  {
    status: 'done',
    row: {
      title: '월간 예산 사용 공유',
      department: '재정부',
      departmentTone: 'emerald',
      tone: 'emerald',
      cycle: '매월',
      assignee: '김민준',
      dueDate: '2026-07-05',
    },
  },
]

// 보는 사람. 실제로는 서버가 세션에서 안다.

// 회의 목록(OPS-MEET-01A). 묶음 하나가 행사 하나이고, 어디에도 속하지 않는 회의는
// '정기·상시 회의' 묶음으로 온다.
const MEETING_GROUPS: DataRow[] = [
  {
    title: '정기·상시 회의',
    nextMeetingNote: '가장 가까운 회의: 07.22 (수) 18:00',
    meetings: [
      {
        title: '7월 예산 검토회의',
        status: '완료',
        statusTone: 'gray',
        startAt: '2026.07.10 14:00',
        place: '온라인 (Zoom)',
        host: '김민준',
        attendees: '5명',
        agenda: '2개',
        minutesStatus: '정리 완료',
        actionLabel: '회의록 보기',
        actionEmphasis: 'secondary',
      },
      {
        title: '학생회 정기 운영회의',
        status: '예정',
        statusTone: 'blue',
        startAt: '2026.07.22 18:00',
        place: '학생회실 (A204)',
        host: '이수현',
        attendees: '12명',
        agenda: '4개',
        minutesStatus: '작성 전',
        actionLabel: '회의 상세 보기',
        actionEmphasis: 'secondary',
      },
      {
        title: '회장단 비공개 안건 조율',
        status: '예정',
        statusTone: 'blue',
        badge: '비공개',
        startAt: '2026.07.24 17:00',
        place: '회장실',
        host: '김바다',
        attendees: '4명',
        agenda: '3개',
        minutesStatus: '작성 전',
        actionLabel: '회의 상세 보기',
        actionEmphasis: 'secondary',
      },
    ],
  },
  {
    title: '2026 소프트웨어융합대학 체육대회',
    nextMeetingNote: '가장 가까운 회의: 07.18 (토) 10:00',
    meetings: [
      {
        title: '체육대회 운영 점검 회의',
        status: '진행 중',
        statusTone: 'green',
        startAt: '2026.07.18 10:00',
        place: '제1회의실',
        host: '박해랑',
        attendees: '8명',
        agenda: '6개',
        minutesStatus: '작성 중',
        actionLabel: '회의로 돌아가기',
        actionEmphasis: 'primary',
      },
      {
        title: '안전 관리 최종 회의',
        status: '예정',
        statusTone: 'blue',
        startAt: '2026.07.25 15:00',
        place: '학생회실',
        host: '박해랑',
        attendees: '4명',
        agenda: '3개',
        minutesStatus: '작성 전',
        actionLabel: '회의 상세 보기',
        actionEmphasis: 'secondary',
      },
    ],
  },
  {
    title: '신입생 환영 행사',
    nextMeetingNote: '가장 가까운 회의: 07.15 (수) 16:00',
    meetings: [
      {
        title: '신입생 환영 행사 기획회의',
        status: '정리 중',
        statusTone: 'yellow',
        startAt: '2026.07.15 16:00',
        place: '온라인 (Discord)',
        host: '이윤슬',
        attendees: '10명',
        agenda: '5개',
        minutesStatus: '내용 열람 가능',
        actionLabel: '회의 내용 보기',
        actionEmphasis: 'secondary',
      },
    ],
  },
  {
    title: '가을 축제',
    nextMeetingNote: '가장 가까운 회의: 08.05 (수) 13:00',
    meetings: [
      {
        title: '가을 축제 1차 준비회의',
        status: '취소',
        statusTone: 'red',
        startAt: '2026.08.05 13:00',
        place: '미정',
        host: '김바다',
        attendees: '15명',
        agenda: '2개',
        minutesStatus: '취소 사유 등록',
        actionLabel: '취소 내용 보기',
        actionEmphasis: 'secondary',
      },
    ],
  },
]

// 행사 목록(EVT-00A 20:4167). 완료된 행사는 이 목록에 오지 않는다 — 머리의 별도
// 이동이 그것을 본다. 딱지(highlights)는 행사마다 개수가 다르다.
const EVENT_LIST: { status: string; row: DataRow }[] = [
  {
    status: 'planning',
    row: {
      title: '2026 소프트웨어융합대학 체육대회',
      status: '기획 중',
      statusTone: 'blue',
      startAt: '2026. 08. 20 10:00',
      place: 'ERICA 체육관',
      host: '학술체육부',
      highlights: [{ label: '신청자 142/200명' }, { label: '명단 확인 필요 6명' }],
      lastModifiedNote: '마지막 수정 오늘 10:30',
    },
  },
  {
    status: 'planning',
    row: {
      title: '2026 신입생 환영 행사',
      status: '기획 중',
      statusTone: 'blue',
      startAt: '일시 미정',
      place: '장소 미정',
      host: '담당 미정',
      highlights: [{ label: '기본 정보 입력 필요' }],
      lastModifiedNote: '마지막 수정 어제 16:20',
    },
  },
  {
    status: 'wrapUp',
    row: {
      title: '봄 축제 학생회 부스',
      status: '후속 정리 중',
      statusTone: 'orange',
      startAt: '2026. 05. 28',
      place: '한양대 ERICA 잔디밭',
      host: '대외협력부',
      highlights: [{ label: '실제 참석자 186명' }],
      alert: '미완료 업무 3건 · 미정리 문서 2건',
      lastModifiedNote: '마지막 수정 2026. 06. 02',
    },
  },
]

// 업무 상세(EVT-TASK-02). 목록이 아니라 한 건이고, 어느 건인지는 화면이 받은
// taskId가 정한다 — 지금까지의 화면은 전부 인자가 없었다.
const TASK_DETAILS: Record<string, DataRow> = {
  'T-03': {
    code: 'T-03',
    title: '현수막 디자인 수정 반영',
    status: '진행 중',
    statusTone: 'blue',
    priority: '높음',
    priorityTone: 'red',
    assignee: '이윤슬',
    department: '홍보부',
    dueDate: '2026-07-18 · 지연',
    description: '검토 의견을 반영해 현수막 디자인을 수정하고 인쇄 전 시안을 확정합니다.',
    completionCriteria: '완료 기준이 아직 등록되지 않았습니다.',
    expectedOutput: '문서·파일',
    linkedItems: [{ label: '현수막 제작 사양서' }, { label: '홍보 가이드라인' }],
  },
}

const TASK_REFERENCE_DOCUMENTS: Record<string, DataRow[]> = {
  'T-03': [
    {
      title: '2026 체육대회 홍보 가이드라인',
      description: '행사 전반의 시각 언어, 색상 코드, 글꼴 사용 기준을 정의합니다.',
      lastModifiedNote: '최종 수정일 2026-07-12',
      status: '확정',
      statusTone: 'green',
    },
    {
      title: '현수막 제작 사양서',
      description: '메인 현수막 및 보조 배너의 규격, 소재, 인쇄 방식에 대한 공식 사양.',
      lastModifiedNote: '최종 수정일 2026-07-10',
      status: '검토 중',
      statusTone: 'yellow',
    },
  ],
}

const TASK_WORK_DOCUMENTS: Record<string, DataRow[]> = {
  'T-03': [
    {
      title: '현수막 시안 v2.png',
      kind: '파일',
      status: '검토 중',
      statusTone: 'yellow',
      officialReflection: '미반영',
    },
    {
      title: '현수막 디자인 작업 노트',
      kind: '문서',
      status: '작성 중',
      statusTone: 'gray',
      officialReflection: '미반영',
    },
  ],
}

const TASK_REVIEW_STATUS: Record<string, DataRow> = {
  'T-03': {
    submission: '제출 완료',
    submissionTone: 'blue',
    officialResult: '미확정',
    officialResultTone: 'gray',
    reviewComment: '메인 색상이 가이드라인과 다름. 교정 후 재제출 바랍니다.',
    nextStepNote: '수정 후 재제출이 필요합니다.',
  },
}

const VIEWER_NAME = '박해랑'

function taskAlerts(): DataRow {
  const rows = TASK_BOARD.map((task) => task.row)
  return {
    delayedCount: rows.filter((row) => row.alert === '지연').length,
    reviewCount: rows.filter((row) => row.alert === '검토 필요').length,
    mineCount: rows.filter((row) => row.assignee === VIEWER_NAME).length,
    unassignedCount: rows.filter((row) => String(row.assignee).startsWith('담당자 없음'))
      .length,
  }
}

export const DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  'meeting.attention': { attentionCount: 2 },
  'home.briefing': { title: '박해랑님, 확인이 필요해요' },
  'home.briefingNotices': [
    { message: '지연된 업무가 1건 있습니다.' },
    { message: '담당자가 없는 업무가 2건 있습니다.' },
  ],
  'home.eventCounts': {
    activeEvents: 1,
    upcomingEvents: 2,
    weeklySchedules: 8,
  },
  'home.events': [
    {
      status: '기획 중',
      title: '2026 소프트웨어융합대학 체육대회',
      date: '2026-08-20',
      place: 'ERICA 체육관',
      team: '학술체육부',
      progressPercent: 62,
      delayedTaskCount: 1,
    },
    {
      status: '기획 중',
      title: '2026 신입생 환영 행사',
      date: '미정',
      place: '미정',
      team: '홍보부',
      progressPercent: 18,
    },
  ],
  'home.schedules': [
    { date: '07.20', title: '체육대회 참가 신청 마감', badge: '마감' },
    { date: '07.20', title: '참가자 모집 공지 작성', badge: '마감' },
    { date: '07.21', title: '주간 운영회의 자료 준비', badge: '마감' },
  ],
  'home.orgAlerts': [
    { kind: 'document', label: '증빙 서류 누락', count: 3 },
    { kind: 'members', label: '참가자 명단 확인 필요', count: 1 },
  ],
  'home.financeSummary': {
    budgetUsedPercent: 34,
    availableBudgetPercent: 66,
    plannedCount: 4,
    missingProofCount: 5,
  },

  // 셸 — 모든 데스크톱 화면이 공유한다.
  'shell.organization': { name: '소프트웨어융합대학' },
  'shell.viewer': { name: '박해랑', role: '운영부 · 부원' },

  // 내 업무(MY-01).
  'my.taskAlerts': { delayedCount: 0, todoCount: 2, reviewCount: 2 },
  // 운영 허브(OPS-00).
  'ops.intro': {
    description:
      '박해랑님이 확인할 업무·회의·행사·일정을 선택하세요. 각 공간에서 역할과 참여 관계에 맞는 다음 행동을 제공합니다.',
  },
  'ops.spaceStats': {
    taskInProgress: 4,
    taskReview: 1,
    meetingToday: 1,
    meetingCleanup: 1,
    eventInProgress: 1,
    eventPlanning: 2,
    calendarThisWeek: 6,
    calendarUpcoming: 4,
  },
  'my.taskTabCounts': countByTab(),
  'task.alerts': taskAlerts(),
}

// 인자를 받는 출처. 실제로는 서버가 걸러 주므로 mock도 여기서 거른다 —
// 받아온 것을 화면에서 거르면 명세(itemList.params)와 다른 것을 구현하게 된다.
//
// MY-01 디자인이 그린 것은 '해야 할 업무' 탭 2건뿐이다. 다른 탭의 행은
// 탭이 실제로 무언가를 바꾸는지 보려고 둔 개발용 값이다(HOME-01K의 일정에서
// 가져왔다). 탭 건수는 이 목록에서 세므로 목록과 배지가 어긋날 수 없다.

function matchesQuery(row: DataRow, query: string): boolean {
  if (query.trim() === '') {
    return true
  }
  const needle = query.trim().toLowerCase()
  return Object.values(row).some((value) =>
    String(value).toLowerCase().includes(needle),
  )
}

export const FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  'task.board': ({ scope = 'all', status = 'planned' }) =>
    TASK_BOARD.filter((task) => task.status === status)
      .filter((task) => scope !== 'mine' || task.row.assignee === VIEWER_NAME)
      .map((task) => task.row),
  // 검색은 묶음이 아니라 회의를 거른다. 남는 회의가 없는 묶음은 통째로 사라진다 —
  // 빈 묶음 머리만 남으면 '총 0건'이 줄줄이 보인다.
  'meeting.groups': ({ query = '' }) =>
    MEETING_GROUPS.map((group) => ({
      ...group,
      meetings: (group.meetings as DataRow[]).filter((row) => matchesQuery(row, query)),
    })).filter((group) => (group.meetings as DataRow[]).length > 0),
  // 진행 단계는 '전체'가 아니면 그 단계만 남긴다. 검색은 행사 이름·장소·담당을 본다.
  'event.list': ({ query = '', status = 'all' }) =>
    EVENT_LIST.filter((event) => status === 'all' || event.status === status)
      .map((event) => event.row)
      .filter((row) => matchesQuery(row, query)),
  // 상세는 목록이 아니지만 인자를 받으므로 같은 자리를 쓴다 — 한 건을 담은
  // 배열로 오고, readObjectSource가 첫 줄을 집는다.
  'task.detail': ({ taskId = '' }) => (TASK_DETAILS[taskId] ? [TASK_DETAILS[taskId]] : []),
  'task.referenceDocuments': ({ taskId = '' }) => TASK_REFERENCE_DOCUMENTS[taskId] ?? [],
  'task.workDocuments': ({ taskId = '' }) => TASK_WORK_DOCUMENTS[taskId] ?? [],
  'task.reviewStatus': ({ taskId = '' }) =>
    TASK_REVIEW_STATUS[taskId] ? [TASK_REVIEW_STATUS[taskId]] : [],
  'my.tasks': ({ tab = 'todo', query = '' }) =>
    MY_TASKS.filter((task) => task.tab === tab)
      .map((task) => task.row)
      .filter((row) => matchesQuery(row, query)),
}


