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

export const DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
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
  'my.tasks': ({ tab = 'todo', query = '' }) =>
    MY_TASKS.filter((task) => task.tab === tab)
      .map((task) => task.row)
      .filter((row) => matchesQuery(row, query)),
}


