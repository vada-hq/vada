import type { TaskDetail, TeamResponse } from '@vada/contracts'
import type { TaskEdit } from '@/tasks/task-edits'

// 업무 상세 시안의 예시 데이터. 실제 학생회 운영진이 쓰는 이름과 업무 모양이다.
export const sampleToday = '2026-10-27'

export const sampleTeam: TeamResponse = {
  departments: [
    { id: 'd1', name: '기획부', role: null, memberCount: 3, color: 'violet' },
    { id: 'd2', name: '홍보부', role: null, memberCount: 2, color: 'pink' },
    { id: 'd3', name: '재정부', role: null, memberCount: 2, color: 'emerald' },
  ],
  members: [
    ['m1', '김하늘', 'd1'],
    ['m2', '이도윤', 'd1'],
    ['m3', '박서연', 'd1'],
    ['m4', '최지우', 'd2'],
    ['m5', '정민준', 'd2'],
    ['m6', '강예린', 'd3'],
    ['m7', '윤시우', 'd3'],
  ].map(([id = '', name = '', department = '']) => ({
    id,
    name,
    councilRank: null,
    departments: [{ id: department, rank: null, actions: [] }],
    joinedAt: '2026-03-02T01:00:00.000Z',
    actions: [],
  })),
}

export const sampleEvents = [
  { id: 'e1', name: '2026 소프트웨어융합대학 체육대회' },
  { id: 'e2', name: '신입생 환영회' },
]

const ALL: TaskDetail['actions'] = [
  'task.edit',
  'task.remove',
  'task.change_department',
  'task.change_assignee',
  'task.change_status',
]

const base: TaskDetail = {
  id: 's0',
  title: '',
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: { id: 'd1', name: '기획부' },
  event: null,
  assignee: null,
  actions: ALL,
  body: null,
  createdBy: { id: 'm1', name: '김하늘' },
  createdAt: '2026-10-20T05:03:00.000Z',
  results: [],
  origin: null,
  canMake: [],
  history: [
    {
      versionNo: 1,
      at: '2026-10-20T05:03:00.000Z',
      by: { id: 'm1', name: '김하늘' },
      cause: null,
      changes: [{ field: 'created' }],
    },
  ],
}

// 카드 순서대로: 지난 마감·담당자 없음·긴 제목, 결과물이 진행 중, 결과물 없음(만들기 넷), 읽기만 하는 사람.
export const sampleTasks: TaskDetail[] = [
  {
    ...base,
    id: 's1',
    origin: {
      meetingId: '0199d1a0-0000-7000-8000-0000000000a1',
      meetingTitle: '체육대회 준비 회의',
      agendaId: '0199d1a0-0000-7000-8000-0000000000f1',
      agendaTitle: '현수막 준비',
    },
    title: '체육대회 현수막 시안 확정하고 인쇄소에 주문 넣기 (본관 정문·체육관 입구 두 곳)',
    dueDate: '2026-10-24',
    overdue: true,
    department: { id: 'd2', name: '홍보부' },
    event: sampleEvents[0] ?? null,
    body: '시안은 홍보부 단톡에 올린 2안으로 해요.\n크기는 가로 5m × 세로 0.9m, 두 장이에요.',
    canMake: ['request', 'registration_form', 'message'],
  },
  {
    ...base,
    id: 's2',
    title: '체육대회 상품 구매',
    status: 'in_progress',
    next: 'done',
    dueDate: '2026-10-30',
    department: { id: 'd3', name: '재정부' },
    event: sampleEvents[0] ?? null,
    assignee: { id: 'm6', name: '강예린', current: true },
    body: '1등~3등 상품과 참가 기념품. 예산 안에서 쿠팡으로 사요.',
    results: [
      {
        kind: 'request',
        id: 'r1',
        title: '체육대회 상품 구매 요청',
        stage: 'in_progress',
        eventId: null,
        roomId: null,
      },
      {
        kind: 'message',
        id: 'n1',
        title: '상품 수령 안내 공지',
        stage: 'finished',
        eventId: null,
        roomId: null,
      },
    ],
    canMake: ['request', 'message'],
  },
  {
    ...base,
    id: 's3',
    title: '신입생 환영회 참가 신청 받기',
    dueDate: '2026-11-03',
    event: sampleEvents[1] ?? null,
    assignee: { id: 'm2', name: '이도윤', current: true },
    canMake: ['request', 'registration_form', 'message', 'event'],
  },
  {
    ...base,
    id: 's4',
    title: '학생회실 비품 정리',
    status: 'done',
    next: null,
    dueDate: '2026-10-21',
    assignee: { id: 'm3', name: '박서연', current: true },
    actions: [],
    body: '쓰지 않는 의자 4개는 학생지원팀에 반납했어요.',
    results: [
      {
        kind: 'message',
        id: 'n2',
        title: '비품 정리 완료 공지',
        stage: 'finished',
        eventId: null,
        roomId: null,
      },
    ],
  },
]

const STATUS_NEXT = { todo: 'in_progress', in_progress: 'done', done: null } as const

// 시안 화면에서 바꾼 값을 서버 없이 그 자리에 반영한다(실제 화면은 서버가 돌려준 업무로 바꾼다).
export function applySampleEdit(task: TaskDetail, edit: TaskEdit): TaskDetail {
  switch (edit.field) {
    case 'status':
      return { ...task, status: edit.status, next: STATUS_NEXT[edit.status] }
    case 'title':
      return { ...task, title: edit.title }
    case 'body':
      return { ...task, body: edit.body }
    case 'dueDate':
      return {
        ...task,
        dueDate: edit.dueDate,
        overdue: edit.dueDate !== null && edit.dueDate < sampleToday,
      }
    default:
      return applyLinkEdit(task, edit)
  }
}

// 이름을 찾아 붙이는 값(행사·부서·담당자).
function applyLinkEdit(task: TaskDetail, edit: TaskEdit): TaskDetail {
  if (edit.field === 'event')
    return { ...task, event: sampleEvents.find(item => item.id === edit.eventId) ?? null }
  if (edit.field === 'department') {
    const found = sampleTeam.departments.find(item => item.id === edit.departmentId)
    return { ...task, department: found ? { id: found.id, name: found.name } : null }
  }
  if (edit.field !== 'assignee') return task
  const found = sampleTeam.members.find(item => item.id === edit.assigneeId)
  return { ...task, assignee: found ? { id: found.id, name: found.name, current: true } : null }
}
