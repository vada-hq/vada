// 개발용 응답. 값은 figma.design.json이 그린 예시를 그대로 옮긴 것이라
// 구현 화면과 reference.png를 눈으로 대조할 수 있다. 백엔드가 붙으면
// catalog.ts의 request.path로 대체된다.
import type { DataRow } from '../data-sources/definitions'
import { ATTENDANCE_FILTERED_FIXTURES } from './fixtures/attendance'
import { CALENDAR_DASHBOARD_FIXTURES, CALENDAR_FILTERED_FIXTURES } from './fixtures/calendar'
import {
  EVENT_DASHBOARD_FIXTURES,
  EVENT_FILTERED_FIXTURES,
  EVENT_TASK_FILTERED_FIXTURES,
} from './fixtures/events'
import { FINANCE_DASHBOARD_FIXTURES, FINANCE_FILTERED_FIXTURES } from './fixtures/finance'
import {
  MEETING_DASHBOARD_FIXTURES,
  MEETING_FILTERED_FIXTURES,
} from './fixtures/meetings'
import {
  ORGANIZATION_DASHBOARD_FIXTURES,
  ORGANIZATION_FILTERED_FIXTURES,
} from './fixtures/organizations'
import { RECORD_DASHBOARD_FIXTURES, RECORD_FILTERED_FIXTURES } from './fixtures/records'
import { SURVEY_FILTERED_FIXTURES } from './fixtures/surveys'
import { TASK_DASHBOARD_FIXTURES } from './fixtures/tasks'

export const DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  ...EVENT_DASHBOARD_FIXTURES,
  ...FINANCE_DASHBOARD_FIXTURES,
  ...RECORD_DASHBOARD_FIXTURES,
  ...CALENDAR_DASHBOARD_FIXTURES,
  ...MEETING_DASHBOARD_FIXTURES,
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
    budgetUsedNote: '34%',
    availableBudgetNote: '66%',
    plannedNote: '4건',
    missingProofNote: '5건',
  },

  // 셸 — 모든 데스크톱 화면이 공유한다.
  // 어느 길이 열려 있는가(SIGN-IN). 배포가 정하므로 진짜는 서버가 답한다.
  'auth.ways': { google: true, kakao: true },
  'shell.organization': { name: '소프트웨어융합대학' },
  'shell.viewer': { name: '박해랑', role: '운영부 · 부원' },

  // 내 업무(MY-01).
  // 내 정보(MY-INFO-01). **고르는 값은 코드와 이름표가 함께 온다** — 코드만 주면
  // 화면이 열리는 순간 사람이 'COL-…'을 본다.
  'my.profile': {
    name: '김바다',
    studentNumber: '2022123456',
    schoolName: '한양대학교 ERICA',
    college: 'COL-HYU-ERICA-SW',
    collegeName: '소프트웨어융합대학',
    department: 'DEP-HYU-ERICA-SW-ICT',
    departmentName: 'ICT융합학부',
    currentGrade: '3',
    currentGradeName: '3학년',
  },
  // 소속은 고치는 값이 아니라 읽는 값이라 출처가 갈려 있다.
  'my.belonging': {
    orgName: '제12대 소프트웨어융합대학 학생회',
    orgDepartment: '회장단',
    executiveTitle: '회장',
  },
  ...TASK_DASHBOARD_FIXTURES,
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
  ...ORGANIZATION_DASHBOARD_FIXTURES,
  // 앱을 열면 어디부터인가. **서버가 세션을 보고 정한다** — 개발용 응답으로 도는
  // 동안은 그림을 보러 온 것이므로 이미 들어온 사람의 자리를 준다.
  'app.start': { screenId: 'HOME-01K' },
  // 메시지 방 목록(MSG-01). **비어 있는 것이 이 저장소가 아는 전부다** —
  // 와이어프레임이 그린 것은 방이 하나도 없는 모습뿐이고, 줄에 무엇이 그려지는지는
  // 어느 프레임에도 없다. 여기에 방을 하나 넣으면 그 줄의 모양을 개발용 응답이
  // 지어내게 되고, 그것은 서버 대역이 아니라 디자인을 만드는 일이다.
  'message.rooms': [],
  // 대화(MSG-03). 같은 이유로 비었다. 빈 상태의 글이 '주고받은 말이 없다'가 아니라
  // **'들어갈 방이 없다'**고 말하므로, message.rooms가 빈 동안 이쪽도 비는 것이 앞뒤가 맞는다.
  'message.conversation': [],
}

// 인자를 받는 출처. 실제로는 서버가 걸러 주므로 mock도 여기서 거른다 —
// 받아온 것을 화면에서 거르면 명세(itemList.params)와 다른 것을 구현하게 된다.

export const FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  ...FINANCE_FILTERED_FIXTURES,
  ...EVENT_TASK_FILTERED_FIXTURES,
  ...EVENT_FILTERED_FIXTURES,
  ...ATTENDANCE_FILTERED_FIXTURES,
  ...SURVEY_FILTERED_FIXTURES,
  ...MEETING_FILTERED_FIXTURES,
  ...RECORD_FILTERED_FIXTURES,
  ...ORGANIZATION_FILTERED_FIXTURES,
  ...CALENDAR_FILTERED_FIXTURES,
}
