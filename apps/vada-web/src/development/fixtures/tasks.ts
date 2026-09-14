import type { DataRow } from '../../data-sources/definitions'
import { matchesQuery } from './search'

export interface EventTaskFixture {
  status: string
  row: DataRow
}

// **갈피와 단계 말은 서버가 정한다**(`tasks/labels.ts`). 사람이 정했다(2026-09-07):
// 그림이 '검토 필요'를 '해야 할 업무'에 놓았지만 서버의 규칙을 따른다 — 검토 중인
// 업무는 아직 안 끝난 것이다. 그림의 갈피 수(2/2/0)는 지키려고 앞의 두 줄을 '예정'으로
// 둔다. 남는 차이는 딱지의 말뿐이고 그것은 자리 예외로 적었다.
const MY_TASKS: Array<{ tab: string; row: DataRow }> = [
  {
    tab: 'todo',
    row: {
      title: '행사 안전 안내문 검토',
      department: '기획부',
      status: '예정',
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
      status: '예정',
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

// 손으로 쓴 상세가 없는 업무는 보드 카드에서 만든다.
//
// 보드에는 카드가 일곱인데 상세는 하나뿐이었다. 여섯 장을 누르면 '업무를 찾지
// 못했습니다'가 뜬다 — 화면은 옳게 동작하지만 **개발용 응답 두 벌이 같은 업무에
// 서로 다른 것을 말하고 있었다.** 재정 보드의 카드가 'PR-01'을 넘기는데 요청
// 상세는 'PR-2026-0031'만 알던 것과 같은 계급이다.
//
// 여섯을 손으로 지어내는 대신 보드에서 만드는 이유: 같은 업무이므로 한쪽이
// 다른 쪽의 근거가 되는 것이 맞고, 손으로 두 벌을 쓰면 또 어긋난다. 카드가
// 모르는 것(설명·완료 기준)은 지어내지 않고 '아직 등록되지 않았습니다'로 둔다 —
// 실제로 아직 아무도 적지 않은 값이다.
const TASK_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  planned: { label: '예정', tone: 'gray' },
  inProgress: { label: '진행 중', tone: 'blue' },
  review: { label: '검토 중', tone: 'violet' },
  done: { label: '완료', tone: 'green' },
}

function taskDetailOf(
  taskId: string,
  eventTaskBoard: EventTaskFixture[],
): DataRow | undefined {
  const written = TASK_DETAILS[taskId]
  if (written !== undefined) {
    return written
  }
  const card = eventTaskBoard.find((entry) => entry.row.id === taskId)
  if (card === undefined) {
    return undefined
  }
  const status = TASK_STATUS_LABEL[card.status] ?? { label: card.status, tone: 'gray' }
  return {
    code: String(card.row.id),
    title: String(card.row.title),
    status: status.label,
    statusTone: status.tone,
    priority: card.row.alert === undefined ? '보통' : '높음',
    priorityTone: card.row.alert === undefined ? 'gray' : 'red',
    assignee: String(card.row.assignee),
    department: String(card.row.department),
    dueDate: String(card.row.dueDate),
    description: '설명이 아직 등록되지 않았습니다.',
    completionCriteria: '완료 기준이 아직 등록되지 않았습니다.',
    expectedOutput: '아직 정해지지 않았습니다.',
    linkedItems: [],
  }
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
      statusTone: 'blue',
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

// 검토 상태가 따로 적히지 않은 업무는 아직 아무것도 제출하지 않은 것이다.
// 없는 것과 아직 안 한 것은 다르다 — 상세를 열 수 있는 업무라면 검토 자리도
// 있어야 하고, 거기 그려질 말은 '미제출'이지 '찾지 못했습니다'가 아니다.
const TASK_REVIEW_NOT_SUBMITTED: DataRow = {
  submission: '미제출',
  submissionTone: 'gray',
  officialResult: '미확정',
  officialResultTone: 'gray',
  reviewComment: '검토 의견이 아직 없습니다.',
  nextStepNote: '결과물을 제출하면 검토가 시작됩니다.',
}

export const VIEWER_NAME = '박해랑'

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

export const TASK_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  'my.taskAlerts': {
    delayedCount: 0,
    todoCount: 2,
    reviewCount: 2,
    myWorkNote: '진행 중·검토 필요 4건',
  },
  'my.taskTabCounts': countByTab(),
  'task.alerts': taskAlerts(),
}

export function createTaskFilteredFixtures(
  eventTaskBoard: EventTaskFixture[],
): Record<string, (params: Record<string, string>) => DataRow[]> {
  return {
    'task.board': ({ scope = 'all', status = 'planned' }) =>
      TASK_BOARD.filter((task) => task.status === status)
        .filter((task) => scope !== 'mine' || task.row.assignee === VIEWER_NAME)
        .map((task) => task.row),
    'task.detail': ({ taskId = '' }) => {
      const detail = taskDetailOf(taskId, eventTaskBoard)
      return detail === undefined ? [] : [detail]
    },
    'task.referenceDocuments': ({ taskId = '' }) => TASK_REFERENCE_DOCUMENTS[taskId] ?? [],
    'task.workDocuments': ({ taskId = '' }) => TASK_WORK_DOCUMENTS[taskId] ?? [],
    'task.reviewStatus': ({ taskId = '' }) =>
      taskDetailOf(taskId, eventTaskBoard) === undefined
        ? []
        : [TASK_REVIEW_STATUS[taskId] ?? TASK_REVIEW_NOT_SUBMITTED],
    'my.tasks': ({ tab = 'todo', query = '' }) =>
      MY_TASKS.filter((task) => task.tab === tab)
        .map((task) => task.row)
        .filter((row) => matchesQuery(row, query)),
  }
}
