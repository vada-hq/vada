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
// 행사 업무 보드(EVT-TASK-01 25:1392·25:1433·25:1505·25:1536)의 카드.
//
// id는 카드에 그려지지 않는다. 그런데도 데이터에 있는 이유는 카드를 누르면 그
// 값이 '어느 업무의 상세인지'로 넘어가기 때문이다 — 제목으로 넘기면 이름이 같은
// 업무가 둘 생기는 날 조용히 어긋난다.
const EVENT_TASK_BOARD: Array<{ eventId: string; status: string; row: DataRow }> = [
  {
    eventId: 'E-01',
    status: 'planned',
    row: {
      id: 'T-05',
      title: '행사장 안전 점검',
      department: '운영부',
      departmentTone: 'teal',
      tone: 'red',
      assignee: '담당자 없음 · 배정 필요',
      dueDate: '2026-08-18',
    },
  },
  {
    eventId: 'E-01',
    status: 'planned',
    row: {
      id: 'T-06',
      title: '참가자 명단 최종 확정',
      department: '기획부',
      departmentTone: 'violet',
      tone: 'red',
      assignee: '담당자 없음 · 배정 필요',
      dueDate: '2026-08-10',
    },
  },
  {
    eventId: 'E-01',
    status: 'inProgress',
    row: {
      id: 'T-01',
      title: '참가자 모집 공지 작성',
      department: '홍보부',
      departmentTone: 'pink',
      tone: 'pink',
      assignee: '이윤슬',
      dueDate: '2026-07-20',
      hasDocuments: '예',
    },
  },
  {
    eventId: 'E-01',
    status: 'inProgress',
    row: {
      id: 'T-03',
      title: '현수막 디자인 수정 반영',
      department: '홍보부',
      departmentTone: 'pink',
      tone: 'pink',
      assignee: '이윤슬',
      dueDate: '2026-07-18 · 지연',
      alert: '지연',
      alertTone: 'red',
      hasDocuments: '예',
    },
  },
  {
    eventId: 'E-01',
    status: 'inProgress',
    row: {
      id: 'T-07',
      title: '물품 구매 요청',
      department: '운영부',
      departmentTone: 'teal',
      tone: 'teal',
      assignee: '박해랑',
      dueDate: '2026-07-25',
    },
  },
  {
    eventId: 'E-01',
    status: 'review',
    row: {
      id: 'T-08',
      title: '행사 안전 안내문 검토',
      department: '기획부',
      departmentTone: 'violet',
      tone: 'violet',
      assignee: '박해랑',
      dueDate: '2026-07-22',
      alert: '검토 필요',
      alertTone: 'yellow',
      hasDocuments: '예',
    },
  },
  {
    eventId: 'E-01',
    status: 'done',
    row: {
      id: 'T-09',
      title: '행사 운영 계획 확정',
      department: '기획부',
      departmentTone: 'violet',
      tone: 'violet',
      assignee: '이수현',
      dueDate: '2026-07-10',
      hasDocuments: '예',
    },
  },
]

// 행사 개요(EVT-02). 전부 이 행사에 딸린 값이라 eventId로 집어 온다.
const EVENT_OVERVIEW: Record<string, Record<string, DataRow>> = {
  'E-01': {
    briefing: {
      headline:
        '모집 마감까지 3일 남았습니다. 정원 200명 중 142명이 신청했고, 명단 확인이 필요한 신청자가 6명 있습니다.',
      stateNote: '현재 상태: 기획 중 · 다음 운영 단계는 모집 마감 확인입니다.',
    },
    highlights: {
      unassignedTasks: '2건',
      unassignedTasksDetail: '행사장 안전 점검 · 참가자 명단 최종 확정',
      needsCheck: '6명',
      needsCheckDetail: '학번·이름 또는 납부 확인',
      nextMilestone: '참가자 모집 공지 작성',
      nextMilestoneDetail: '07.20 · 이윤슬',
    },
    basics: {
      title: '2026 소프트웨어융합대학 체육대회',
      startAt: '08. 20. (목) 10:00',
      place: 'ERICA 체육관',
      audience: '소프트웨어융합대학 전체',
      fee: '납부자 무료 / 미납자 5000원',
      capacity: '200명',
      contact: '카카오톡 채널 @swcollege',
    },
    recruitSettings: {
      surveyStatus: '초안',
      period: '마감일 미입력',
      method: '선착순',
      applicantCount: '142명',
    },
    participantStats: {
      applicants: '142명',
      applicantsNote: '정원 200명',
      paid: '129명',
      paidNote: '미납 13명',
      needsCheck: '6명',
      needsCheckNote: '명단 불일치',
      unassignedTasks: '2개',
      unassignedTasksNote: '처리 필요',
    },
  },
}

const EVENT_CHECKLIST: Record<string, DataRow[]> = {
  'E-01': [
    {
      title: '명단 확인이 필요한 신청자 6명',
      detail: '학번·이름 불일치 또는 명단 외 학생',
      tone: 'yellow',
      actionLabel: '참가자 명단 보기',
    },
    {
      title: '모집 마감까지 3일 남았습니다',
      detail: '2026. 07. 20 마감',
      tone: 'orange',
    },
    {
      title: '담당자 없는 업무 2개',
      detail: '현장 준비 · 장비 반납',
      tone: 'red',
      actionLabel: '업무 보기',
    },
    {
      title: 'QR 참석 확인 설정 완료',
      detail: '행사 시작 시 활성화',
      tone: 'green',
    },
  ],
}

const EVENT_RECENT_CHANGES: Record<string, DataRow[]> = {
  'E-01': [
    { at: '오늘 10:30', title: '신규 신청자 5명 추가' },
    { at: '어제 16:20', title: 'QR 참석 확인 활성화' },
    { at: '07. 14', title: '행사 장소 ERICA 체육관으로 확정' },
    { at: '07. 12', title: '운영 조직 구성 완료' },
  ],
}

// 행사 작업 공간의 머리와 행사 카드. 갈피를 옮겨 다녀도 그대로인 값이다.
// 행사 문서(EVT-DOC-01). 표의 한 줄이고, 상태 필터가 고른 값으로 걸러서 온다 —
// 받아온 것을 화면에서 거르지 않으므로 여기서 거른다.
//
// id는 표에 그려지지 않는다. 그런데도 데이터에 있는 이유는 업무 카드와 같다 —
// 문서를 여는 화면이 생기면 그 값이 '어느 문서인지'로 넘어간다.
const EVENT_DOCUMENTS: Array<{ eventId: string; status: string; row: DataRow }> = [
  {
    eventId: 'E-01',
    status: 'confirmed',
    row: {
      id: 'DOC-01',
      category: '기획',
      title: '행사 운영 계획서',
      description: '운영 목표, 역할 분담, 당일 진행 순서',
      status: '확정',
      statusTone: 'green',
      tone: 'blue',
      updatedNote: '07. 12 · 이수현',
    },
  },
  {
    eventId: 'E-01',
    status: 'reviewing',
    row: {
      id: 'DOC-02',
      category: '운영',
      title: '안전 관리 체크리스트',
      description: '현장 안전 점검 및 비상 대응 항목',
      status: '검토 중',
      statusTone: 'yellow',
      tone: 'amber',
      updatedNote: '07. 18 · 박해랑',
    },
  },
  {
    eventId: 'E-01',
    status: 'drafting',
    row: {
      id: 'DOC-03',
      category: '참가자',
      title: '참가자 명단 최종본',
      description: '신청·납부·참석 확인 기준의 최종 명단',
      status: '작성 중',
      statusTone: 'blue',
      tone: 'violet',
      updatedNote: '07. 19 · 김바다',
    },
  },
  {
    eventId: 'E-01',
    status: 'notStarted',
    row: {
      id: 'DOC-04',
      category: '후속 정리',
      title: '행사 결과 보고서',
      description: '운영 결과와 정산 자료를 정리하는 문서',
      status: '작성 전',
      statusTone: 'gray',
      tone: 'gray',
      // 아직 손댄 적이 없으므로 언제 쓸 것인지로 온다.
      updatedNote: '행사 종료 후',
    },
  },
]

const EVENT_DOCUMENT_STATS: Record<string, DataRow> = {
  'E-01': {
    total: '4개',
    totalNote: '행사 공용 문서',
    drafting: '1개',
    draftingNote: '계속 확인이 필요해요',
    reviewing: '1개',
    reviewingNote: '의견 확인이 필요해요',
  },
}

// 행사 관련 회의(EVT-MEET-01). 회의 전체 목록(meeting.groups)과 다른 것이다 —
// 저쪽은 행사별로 묶어 오고 카드에 담기는 조각도 더 많다.
//
// 참가 인원의 세는 말이 회의마다 다르다(참가 · 참가 예정 · 참석). 끝난 회의인지에
// 따라 갈리므로 화면이 유도할 수 없어 완성된 문구로 온다.
const EVENT_MEETINGS: Array<{ eventId: string; row: DataRow }> = [
  {
    eventId: 'E-01',
    row: {
      id: 'M-01',
      status: '진행 중',
      statusTone: 'blue',
      kindLabel: '행사 연결 회의',
      title: '체육대회 운영 점검 회의',
      startAt: '2026. 07. 18 (토) 10:00',
      place: '제1회의실',
      attendanceNote: '참가 8명',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'M-02',
      status: '예정',
      statusTone: 'yellow',
      kindLabel: '행사 연결 회의',
      title: '안전 관리 최종 회의',
      startAt: '2026. 07. 25 (토) 15:00',
      place: '학생회실',
      attendanceNote: '참가 예정 4명',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'M-03',
      status: '완료',
      statusTone: 'green',
      kindLabel: '행사 연결 회의',
      title: '참가자 모집 결과 검토',
      startAt: '2026. 07. 12 (일) 18:00',
      place: '온라인 (Discord)',
      attendanceNote: '참석 6명',
    },
  },
]

const EVENT_MEETING_COUNTS: Record<string, DataRow> = {
  'E-01': { countsNote: '진행 중 1건 · 예정 1건 · 정리 중 0건 · 완료 1건' },
}

// 행사 참가자. 학생회 구성원이 아닐 수 있어 조직 명단과 다른 것이다.
const EVENT_PARTICIPANTS: Array<{ eventId: string; row: DataRow }> = [
  {
    eventId: 'E-01',
    row: {
      id: 'P-01',
      name: '김학생',
      studentNo: '2022111111',
      affiliation: '컴퓨터학부',
      applyStatus: '신청 완료',
      applyStatusTone: 'blue',
      payStatus: '납부 확인',
      payStatusTone: 'green',
      attendStatus: '미확인',
      attendStatusTone: 'gray',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'P-02',
      name: '이수강',
      studentNo: '2023222222',
      affiliation: 'ICT융합학부',
      applyStatus: '신청 완료',
      applyStatusTone: 'blue',
      payStatus: '미납',
      payStatusTone: 'red',
      attendStatus: '미확인',
      attendStatusTone: 'gray',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'P-03',
      name: '박참여',
      studentNo: '2021333333',
      affiliation: '인공지능학과',
      applyStatus: '신청 완료',
      applyStatusTone: 'blue',
      payStatus: '납부 확인',
      payStatusTone: 'green',
      attendStatus: '참석',
      attendStatusTone: 'green',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'P-04',
      name: '최대기',
      studentNo: '2024444444',
      affiliation: '컴퓨터학부',
      applyStatus: '대기 중',
      applyStatusTone: 'gray',
      payStatus: '미확인',
      payStatusTone: 'gray',
      attendStatus: '미확인',
      attendStatusTone: 'gray',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'P-05',
      name: '강신청',
      studentNo: '2022555555',
      affiliation: '컴퓨터학부',
      applyStatus: '신청 완료',
      applyStatusTone: 'blue',
      payStatus: '납부 확인',
      payStatusTone: 'green',
      attendStatus: '불참',
      attendStatusTone: 'red',
    },
  },
  {
    eventId: 'E-01',
    row: {
      id: 'P-06',
      name: '윤확인',
      studentNo: '2023666666',
      affiliation: '컴퓨터학부',
      applyStatus: '신청 완료',
      applyStatusTone: 'blue',
      payStatus: '미확인',
      payStatusTone: 'gray',
      attendStatus: '미확인',
      attendStatusTone: 'gray',
    },
  },
]

// 한 쪽에 몇 줄인지. 서버가 정하는 값이라 명세에는 없고, 붙박이 값이 서버 노릇을
// 하는 동안만 여기 있다. 여섯 줄뿐이라 실제로 쪽이 갈리지는 않는다.
const PARTICIPANT_PAGE_SIZE = 20

// 행사 재정. 금액은 자릿점까지 찍힌 글로 온다 — 화폐 표기는 조직·지역의 것이다.
const EVENT_FINANCE_SUMMARY: Record<string, DataRow> = {
  'E-01': {
    budget: '3,000,000',
    committed: '1,100,000',
    spent: '950,000',
    available: '950,000',
  },
}

const EVENT_FINANCE_ALERTS: Record<string, DataRow> = {
  'E-01': { pendingReviewCount: 1 },
}

// 처리 단계는 명세에 고정이고(디자인이 네 열을 그린다) 각 열에 몇 장이 오는지가
// 데이터에 달렸다. 행사 업무 보드와 같은 모양이다.
const EVENT_FINANCE_BOARD: Array<{ eventId: string; stage: string; row: DataRow }> = [
  {
    eventId: 'E-01',
    stage: 'review',
    row: {
      id: 'PR-2026-0031',
      departmentLabel: '운영부',
      requestedAt: '2026-03-15',
      title: '체육대회 운영 물품 4종',
      itemsNote: '품목 4개 · 박스테이프, 생수 500ml, 이름표 용지, 유성 마커',
      amountNote: '135,000원',
      status: '검토 대기',
      statusTone: 'blue',
    },
  },
  {
    eventId: 'E-01',
    stage: 'review',
    row: {
      id: 'PR-02',
      departmentLabel: '홍보부',
      requestedAt: '2026-03-14',
      title: '현수막 A형 제작',
      itemsNote: '품목 1개 · 메인 현수막',
      amountNote: '180,000원',
      status: '보완 요청',
      statusTone: 'orange',
    },
  },
]

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

// 행사 일정. 원본은 여기가 아니다 — 업무·회의·행사 기본정보가 각자 원본이고 이
// 목록은 그것이 비친 것이다. 그래서 줄마다 originNote가 어디를 고쳐야 하는지 말한다.
//
// buckets는 서버가 답을 아는 자리를 흉내 낸 것이다. '이번 주'는 오늘이 언제냐에
// 달렸고 그것은 화면도 이 붙박이 값도 모른다 — 그래서 어느 묶음에 드는지를 미리
// 적어 둔다.
const EVENT_SCHEDULE: Array<{ eventId: string; buckets: string[]; row: DataRow }> = [
  {
    eventId: 'E-01',
    buckets: [],
    row: {
      id: 'SCH-01',
      dateLabel: '07. 10',
      tone: 'gray',
      title: '행사 운영 계획 확정',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '완료 · 행사 운영 계획의 범위와 역할 분담을 최종 확정합니다.',
      ownerNote: '담당 · 이수현',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: ['thisWeek'],
    row: {
      id: 'SCH-02',
      dateLabel: '07. 18',
      tone: 'gray',
      title: '현수막 디자인 수정 반영',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '진행 중 · 지연 · 검토 의견을 반영해 현수막 디자인을 수정하고 인쇄 전 시안을 확정합니다.',
      ownerNote: '담당 · 이윤슬',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: ['thisWeek', 'deadline'],
    row: {
      id: 'SCH-03',
      dateLabel: '07. 20',
      tone: 'gray',
      title: '참여 설문 마감',
      kindLabel: '마감',
      kindTone: 'yellow',
      description: '신청 현황 및 대기자 확인',
      ownerNote: '담당 · 홍보팀',
      originNote: '원본 · 참여 설문',
    },
  },
  {
    eventId: 'E-01',
    buckets: ['thisWeek'],
    row: {
      id: 'SCH-04',
      dateLabel: '07. 20',
      tone: 'gray',
      title: '참가자 모집 공지 작성',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '진행 중 · 참가 신청 일정과 안내 사항을 포함한 모집 공지를 작성합니다.',
      ownerNote: '담당 · 이윤슬',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: ['thisWeek'],
    row: {
      id: 'SCH-05',
      dateLabel: '07. 22',
      tone: 'gray',
      title: '행사 안전 안내문 검토',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '검토 필요 · 참가자에게 전달할 안전 안내문을 검토하고 승인 의견을 남깁니다.',
      ownerNote: '담당 · 박해랑',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: ['meeting'],
    row: {
      id: 'SCH-06',
      dateLabel: '07. 25',
      tone: 'gray',
      title: '안전 관리 최종 회의',
      kindLabel: '회의',
      kindTone: 'gray',
      description: '관련 회의에서 세부 안건 확인',
      ownerNote: '담당 · 박해랑',
      originNote: '원본 · 관련 회의',
    },
  },
  {
    eventId: 'E-01',
    buckets: [],
    row: {
      id: 'SCH-07',
      dateLabel: '07. 25',
      tone: 'gray',
      title: '물품 구매 요청',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '진행 중 · 행사 운영 물품을 정리하고 구매 요청서를 제출합니다.',
      ownerNote: '담당 · 박해랑',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: [],
    row: {
      id: 'SCH-08',
      dateLabel: '08. 10',
      tone: 'gray',
      title: '참가자 명단 최종 확정',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '예정 · 신청과 확인이 끝난 참가자 명단을 최종 확정합니다.',
      ownerNote: '담당 · 미지정 · 배정 필요',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: [],
    row: {
      id: 'SCH-09',
      dateLabel: '08. 18',
      tone: 'gray',
      title: '행사장 안전 점검',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '예정 · 행사장 동선과 안전 설비를 점검하고 개선 사항을 등록합니다.',
      ownerNote: '담당 · 미지정 · 배정 필요',
      originNote: '원본 · 행사 업무',
    },
  },
  {
    eventId: 'E-01',
    buckets: ['eventDay'],
    row: {
      id: 'SCH-10',
      dateLabel: '08. 20',
      tone: 'blue',
      title: '2026 소프트웨어융합대학 체육대회',
      kindLabel: '행사',
      kindTone: 'blue',
      description: '2026.08.20 10:00 ~ 14:00 · ERICA 체육관',
      ownerNote: '담당 · 김바다',
      originNote: '원본 · 행사 기본정보',
    },
  },
  {
    eventId: 'E-01',
    buckets: [],
    row: {
      id: 'SCH-11',
      dateLabel: '행사 후',
      tone: 'gray',
      title: '결과 보고·정산 자료 정리',
      kindLabel: '후속',
      kindTone: 'gray',
      description: '후속 정리 단계에서 진행',
      ownerNote: '담당 · 미정',
      originNote: '원본 · 행사 업무',
    },
  },
]

const EVENT_WORKSPACES: Record<string, DataRow> = {
  'E-01': {
    status: '기획 중',
    statusTone: 'blue',
    alert: '주의 · 지연 업무 1건',
    alertTone: 'red',
    host: '담당 학술체육부 · 김바다',
    startAt: '08.20 10:00',
    nextSchedule: '다음 일정 · 07.20 참가자 모집 공지 작성',
    permissionNote: '행사 관리 행동은 담당 운영진에게 제공됩니다.',
  },
}

const EVENT_SUMMARIES: Record<string, DataRow> = {
  'E-01': {
    title: '2026 소프트웨어융합대학 체육대회',
    schedule: '행사일 2026-08-20 · ERICA 체육관',
    dday: 'D-33',
    progressPercent: 14,
    progressLabel: '1 / 7 완료',
  },
}


// 이 행사에서 내가 낸 구매 요청. 재정 보드의 카드와 같은 요청이므로 id를 맞춘다 —
// 두 벌이 같은 것에 다른 이름을 붙이면 눌러도 상세가 열리지 않는다.
const MY_PURCHASE_REQUESTS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'PR-2026-0031',
      code: 'REQ-001',
      title: '체육대회 운영 물품 4종',
      amountNote: '135,000원',
      itemCountNote: '4종',
      requestedAt: '2026-03-01',
      neededOn: '2026-03-15',
      status: '검토 대기',
      statusTone: 'blue',
    },
  ],
}

// 상태별 개수는 목록에서 세지 않는다. 무엇을 어느 칸에 넣는지가 곧 조직의 절차라
// 서버가 안다 — 화면이 세면 절차가 화면에 적히게 된다.
const MY_PURCHASE_REQUEST_SUMMARY: Record<string, DataRow> = {
  'E-01': {
    scopeNote: '이 행사에서 내가 제출한 구매 요청 · 박해랑 · 운영부 · 부원',
    reviewCount: '1',
    supplementCount: '0',
    approvedCount: '0',
    purchasingCount: '0',
    doneCount: '0',
  },
}


// 보완 요청. 재정부가 이름표 용지 하나에 보완을 걸었다(FIN-REQ-02의 표에서 그
// 품목만 '보완 필요'다 — 두 개발용 응답이 같은 것을 말한다).
const SUPPLEMENT_REQUESTS: Record<string, DataRow> = {
  'PR-2026-0031': {
    reviewerNote: '요청 담당자 김바다',
    requestedAtNote: '보완 요청일 2026-03-03',
    dueNote: '재제출 권장 기한 2026-03-07',
  },
}

const SUPPLEMENT_ITEMS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PRI-03',
      title: '보완 품목 — 이름표 용지',
      categoryNote: '제작·인쇄 · 홍보비',
      reason:
        '규격과 인쇄 사양이 누락되었습니다. 정확한 사이즈, 색상, 인쇄 위치를 명시하고 업체 견적서를 첨부해 주세요. 200장 기준 최소 2개 이상 업체 견적서 필요합니다.',
      name: '이름표 용지',
      quantityNote: '200장',
      unitPriceNote: '300원',
      amountNote: '60,000원',
      budgetItem: '행사 운영비',
    },
  ],
}

// 무엇을 다시 묻는지는 그 품목의 구매 유형이 정한다. 제작·인쇄라서 이 넷이고,
// 온라인 구매였다면 판매처와 상품 URL을 물었을 것이다 — 그래서 명세가 아니라
// 여기(서버 대역)에 있다.
const SUPPLEMENT_INPUT_FIELDS: Record<string, DataRow[]> = {
  'PRI-03': [
    { key: 'size', label: '사이즈·규격', placeholder: '예: A4 (210×297mm)' },
    { key: 'color', label: '색상', placeholder: '예: 단색(검정)' },
    { key: 'printArea', label: '인쇄 위치', placeholder: '예: 전면 단면 인쇄' },
    { key: 'optionQuantity', label: '옵션별 수량', placeholder: '예: 기본형 200매' },
  ],
}

const SUPPLEMENT_ATTACHMENTS: Record<string, DataRow[]> = {
  'PRI-03': [
    { key: 'designFile', label: '디자인 파일', placeholder: '클릭하여 파일 추가' },
    { key: 'printFile', label: '인쇄 파일', placeholder: '클릭하여 파일 추가' },
    { key: 'quote', label: '견적서', placeholder: '클릭하여 파일 추가' },
  ],
}


// 재정부가 보는 같은 요청. 요청자가 보는 것(finance.purchaseRequestDetail)과 겹치는
// 조각이 있지만 예산 사용 가능액은 이쪽에만 온다.
const REVIEW_SUMMARIES: Record<string, DataRow> = {
  'PR-2026-0031': {
    code: 'REQ-001',
    status: '보완 요청',
    statusTone: 'yellow',
    amountNote: '135,000원',
    budgetAvailableNote: '950,000원',
    eventName: '2026 소프트웨어융합대학 체육대회',
    department: '운영부',
    requester: '박해랑',
    neededOn: '2026-03-15',
    requestedAt: '2026-03-01',
    purpose: '행사 당일 운영 및 물품 관리',
  },
}

const REVIEW_ITEMS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PRI-01',
      result: '승인',
      name: '박스테이프',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '5개',
      amountNote: '10,000원',
      approvedAmount: '10000',
    },
    {
      id: 'PRI-02',
      result: '승인',
      name: '생수 500ml',
      categoryNote: '식음료 · 식비',
      purchaseType: '일반 구매',
      quantityNote: '10박스',
      amountNote: '50,000원',
      approvedAmount: '50000',
    },
    {
      id: 'PRI-03',
      result: '보완',
      name: '이름표 용지',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '200장',
      amountNote: '60,000원',
      approvedAmount: '60000',
    },
    {
      id: 'PRI-04',
      result: '승인',
      name: '유성 마커',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '10개',
      amountNote: '15,000원',
      approvedAmount: '15000',
    },
  ],
}


// 구매·발주. 묶음 하나가 업체 하나다 - 같은 요청의 품목 넷이 세 업체로 갈렸고,
// 인쇄업체는 아직 주문하지 못했다(품절). 없는 것과 아직 안 한 것은 다르다.
const PURCHASE_ORDER_SUMMARIES: Record<string, DataRow> = {
  'PR-2026-0031': {
    eventName: '2026 소프트웨어융합대학 체육대회',
    code: 'REQ-001',
    status: '구매 진행 중',
    statusTone: 'blue',
    title: '체육대회 운영 물품 4종',
    requesterNote: '운영부 · 박해랑 · 필요한 날짜 2026-03-15',
    approvedAmountNote: '135,000원',
  },
}

const PURCHASE_ORDERS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PO-01',
      vendor: '다이소 온라인몰',
      orderNote: '주문일 2026-03-08 · 담당 김바다',
      amountNote: '25,000원',
      items: [
        {
          id: 'POI-01',
          name: '박스테이프',
          quantityNote: '5개',
          amountNote: '10,000원',
          orderStatus: '주문 완료',
          orderStatusTone: 'green',
          deliveryOn: '2026-03-12',
          deliveryStatus: '배송 중',
          deliveryStatusTone: 'blue',
        },
        {
          id: 'POI-02',
          name: '유성 마커',
          quantityNote: '10개',
          amountNote: '15,000원',
          orderStatus: '주문 완료',
          orderStatusTone: 'green',
          deliveryOn: '2026-03-12',
          deliveryStatus: '배송 중',
          deliveryStatusTone: 'blue',
        },
      ],
    },
    {
      id: 'PO-02',
      vendor: '마켓컬리 B2B',
      orderNote: '주문일 2026-03-10 · 담당 김바다',
      amountNote: '50,000원',
      items: [
        {
          id: 'POI-03',
          name: '생수 500ml',
          quantityNote: '10박스',
          amountNote: '50,000원',
          orderStatus: '주문 완료',
          orderStatusTone: 'green',
          deliveryOn: '2026-03-15',
          deliveryStatus: '배송 예정',
          deliveryStatusTone: 'gray',
        },
      ],
    },
    {
      id: 'PO-03',
      vendor: '인쇄업체 A (제작 발주)',
      orderNote: '주문일 — · 담당 —',
      amountNote: '60,000원',
      items: [
        {
          id: 'POI-04',
          name: '이름표 용지 (제작)',
          quantityNote: '200장',
          amountNote: '60,000원',
          orderStatus: '품절·변경 필요',
          orderStatusTone: 'red',
          deliveryOn: '—',
          deliveryStatus: '—',
          deliveryStatusTone: 'red',
        },
      ],
    },
  ],
}


// 결제·증빙. 묶음 하나가 결제 하나이고, 연결된 품목과 증빙 서류가 그 결제와 함께
// 온다 - 따로 있는 것이 아니라 그 결제의 일부다.
//
// 실결제 합계가 승인 금액보다 2,500원 많다. 초과를 어떻게 처리할지는 조직의 재정
// 규칙이라 이 화면은 사실만 적고 막지 않는다(사람이 확인했다).
const PAYMENT_EVIDENCE_SUMMARIES: Record<string, DataRow> = {
  'PR-2026-0031': {
    eventName: '2026 소프트웨어융합대학 체육대회',
    code: 'REQ-001',
    status: '증빙 정리 중',
    statusTone: 'blue',
    title: '체육대회 운영 물품 4종',
    requesterNote: '운영부 · 박해랑',
    approvedAmountNote: '135,000원',
    paidAmountNote: '137,500원',
    // 증빙 둘이 비어 있으므로 아직 끝낼 수 없다. 무엇이 '다 됐다'인지는 서버가 안다.
    completeBlockedNote: '증빙 서류 2건이 아직 등록되지 않았습니다.',
  },
}

const PAYMENT_EVIDENCES: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PAY-01',
      vendor: '다이소 온라인몰',
      paidNote: '결제일 2026-03-08 · 결제자 김바다 · 법인카드',
      amountNote: '승인 25,000원 → 실결제 24,500원',
      gapNote: '실결제액이 승인액보다 500원 적음',
      items: [
        { id: 'POI-01', name: '박스테이프' },
        { id: 'POI-02', name: '유성 마커' },
      ],
      documents: [
        { id: 'DOC-01', label: '영수증', status: '등록 완료', statusTone: 'green' },
        { id: 'DOC-02', label: '거래명세서', status: '등록 완료', statusTone: 'green' },
      ],
    },
    {
      id: 'PAY-02',
      vendor: '마켓컬리 B2B',
      paidNote: '결제일 2026-03-10 · 결제자 김바다 · 계좌이체',
      amountNote: '승인 50,000원 → 실결제 50,000원',
      items: [{ id: 'POI-03', name: '생수 500ml' }],
      documents: [
        { id: 'DOC-03', label: '영수증', status: '누락', statusTone: 'red' },
        { id: 'DOC-04', label: '거래명세서', status: '등록 완료', statusTone: 'green' },
      ],
    },
    {
      id: 'PAY-03',
      vendor: '인쇄업체 A',
      paidNote: '결제일 2026-03-13 · 결제자 김바다 · 계좌이체',
      amountNote: '승인 60,000원 → 실결제 63,000원',
      gapNote: '견적서 대비 최종 납품가 3,000원 초과',
      items: [{ id: 'POI-04', name: '이름표 용지 (제작)' }],
      documents: [
        { id: 'DOC-05', label: '견적서', status: '등록 완료', statusTone: 'green' },
        { id: 'DOC-06', label: '거래명세서', status: '등록 완료', statusTone: 'green' },
        { id: 'DOC-07', label: '세금계산서', status: '누락', statusTone: 'red' },
      ],
    },
  ],
}

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

function taskDetailOf(taskId: string): DataRow | undefined {
  const written = TASK_DETAILS[taskId]
  if (written !== undefined) {
    return written
  }
  const card = EVENT_TASK_BOARD.find((entry) => entry.row.id === taskId)
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
  // 조직 관리 홈(ORG-00). 디자인이 그린 그대로의 한 줄이다 - 셈한 숫자가 아니라
  // 서버가 완성해 보내는 문장이라는 것이 이 출처의 계약이다.
  'org.areaSummaries': {
    departments: '부서 5개 · 구성원 18명',
    students: '학생 1,284명 · 최근 갱신 07.01',
    roles: '기본 역할 3종 · 확정된 권한 매트릭스',
  },
  'org.chartTitle': { name: '제12대 소프트웨어융합대학 학생회' },
  'org.unassignedHint': { hint: '2명 · 드래그해서 부서로 이동' },
  'org.invite': {
    stateLabel: '활성',
    stateTone: 'green',
    stateNote: '현재 사용할 수 있는 초대 정보입니다.',
    regeneratedNote: '마지막 재생성: 2026.07.22 18:30',
    url: 'https://vada.app/join/swcollege12/abc123xyz',
    code: 'AB12CD34',
  },

  // 조직도(ORG-03A). 디자인이 그린 그대로다 - 회장단 둘, 부서 셋이고
  // **기획부만 부서장이 있다.** 그 없음이 '＋ 부서장 지정'을 부르는 자리다.
  'org.executives': [
    {
      id: 'M-01',
      name: '김바다',
      major: '컴퓨터학부',
      grade: '3학년',
      roleLabel: '회장',
      roleTone: 'yellow',
    },
    {
      id: 'M-02',
      name: '이윤슬',
      major: 'ICT융합학부',
      grade: '4학년',
      roleLabel: '부회장',
      roleTone: 'blue',
    },
  ],
  'org.departments': [
    {
      id: 'D-01',
      name: '기획부',
      memberCountLabel: '부원 2명',
      leaders: [{ id: 'M-03', name: '박해랑', major: '컴퓨터학부', grade: '3학년' }],
      members: [
        { id: 'M-04', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
        { id: 'M-05', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' },
      ],
    },
    {
      id: 'D-02',
      name: '홍보부',
      memberCountLabel: '부원 2명',
      leaders: [],
      members: [
        { id: 'M-06', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' },
        { id: 'M-07', name: '정하늘', major: '컴퓨터학부', grade: '3학년' },
      ],
    },
    {
      id: 'D-03',
      name: '디자인부',
      memberCountLabel: '부원 1명',
      leaders: [],
      members: [{ id: 'M-08', name: '정하늘', major: '컴퓨터학부', grade: '3학년' }],
    },
  ],
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

// 개요의 조각들은 한 행사에 딸려 있으므로 한 자리에 모아 두고 이름으로 집는다.
function overview(eventId: string, part: string): DataRow[] {
  const row = EVENT_OVERVIEW[eventId]?.[part]
  return row === undefined ? [] : [row]
}


// 고치려는 구매 요청 한 건. 품목 넷과 수량·단가는 디자인이 그린 그대로다 —
// 5×2000=10,000, 10×5000=50,000, 200×300=60,000, 10×1500=15,000이고 합이
// 135,000이다. 디자인의 셈이 맞는지 여기서 확인된다.
//
// 카테고리·예산 항목·구매 유형은 디자인이 넷 다 빈 드롭다운으로 그렸다. 채워
// 넣으면 그림에 없는 사실이 되므로 빈 채로 둔다.
const PURCHASE_REQUEST_ITEMS: DataRow[] = [
  {
    itemName: '박스테이프',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 5,
    unit: '개',
    unitPrice: 2000,
    quoteStatus: 'none',
  },
  {
    itemName: '생수 500ml',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 10,
    unit: '박스',
    unitPrice: 5000,
    quoteStatus: 'none',
  },
  {
    itemName: '이름표 용지',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 200,
    unit: '장',
    unitPrice: 300,
    quoteStatus: 'none',
  },
  {
    itemName: '유성 마커',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 10,
    unit: '개',
    unitPrice: 1500,
    quoteStatus: 'none',
  },
]

// 아직 아무것도 적히지 않은 요청. 비어 있지 않은 것이 둘 있다 — 작성자의 소속
// 부서와 품목 한 줄이다. 부서는 서버가 이미 알고, 품목 한 줄은 minItems가 정한다.
const EMPTY_PURCHASE_REQUEST_ITEM: DataRow = {
  itemName: '',
  itemCategory: '',
  budgetItem: '',
  purchaseType: '',
  quantity: '',
  unit: '',
  unitPrice: '',
  quoteStatus: 'none',
}

export const PURCHASE_REQUEST_DRAFTS: Record<string, DataRow> = {
  'PR-2026-0031': {
    title: '체육대회 운영 물품',
    department: '운영부',
    neededOn: '2026-08-12',
    priority: '보통',
    purpose: '',
    items: PURCHASE_REQUEST_ITEMS,
  },
}

export const NEW_PURCHASE_REQUEST: DataRow = {
  title: '',
  department: '운영부',
  neededOn: '',
  priority: '',
  purpose: '',
  items: [EMPTY_PURCHASE_REQUEST_ITEM],
}


// 구매 요청 한 건의 상세. 값은 전부 design(30:822)이 그린 그대로다.
//
// 자릿점과 단위가 찍힌 글로 오는 것에 주의한다 — 이 화면은 아무것도 셈하지 않는다.
// 이미 일어난 일의 금액이라 서버의 것이다(FIN-REQ-01과 반대다).
const PURCHASE_REQUEST_DETAILS: Record<string, DataRow> = {
  'PR-2026-0031': {
    code: 'REQ-001',
    status: '보완 요청',
    statusTone: 'yellow',
    title: '체육대회 운영 물품 4종',
    amountNote: '135,000원',
    eventName: '2026 소프트웨어융합대학 체육대회',
    department: '운영부',
    requester: '박해랑',
    neededOn: '2026-03-15',
    stage: 'review',
  },
}

const PURCHASE_REQUEST_RESULTS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'it-1',
      name: '박스테이프',
      quantityNote: '5개',
      amountNote: '10,000원',
      result: '승인',
      resultTone: 'green',
      note: '—',
    },
    {
      id: 'it-2',
      name: '생수 500ml',
      quantityNote: '10박스',
      amountNote: '50,000원',
      result: '승인',
      resultTone: 'green',
      note: '—',
    },
    {
      id: 'it-3',
      name: '이름표 용지',
      quantityNote: '200장',
      amountNote: '60,000원',
      result: '보완 필요',
      resultTone: 'yellow',
      note: '규격·수량 확인 후 견적서 재첨부 요망',
    },
    {
      id: 'it-4',
      name: '유성 마커',
      quantityNote: '10개',
      amountNote: '15,000원',
      result: '승인',
      resultTone: 'green',
      note: '—',
    },
  ],
}

// 시간순으로 온다. 화면이 다시 정렬하지 않는다.
const PURCHASE_REQUEST_HISTORY: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    { id: 'h-1', action: '제출', actorNote: '박해랑 · 2026-03-01 10:05' },
    { id: 'h-2', action: '재정부 검토 시작', actorNote: '김바다 · 2026-03-02 09:30' },
    { id: 'h-3', action: '보완 요청 발송', actorNote: '김바다 · 2026-03-03 14:00' },
  ],
}

// 아직 어느 자리에도 없는 사람들. 디자인이 둘을 그렸다.
// **id가 겹치면 안 된다.** 한 사람은 정확히 한 자리에 있다는 것이 이 화면의
// 규칙이고, 같은 id가 부서와 여기에 함께 있으면 옮기기가 무엇을 옮기는지
// 말할 수 없다. 와이어프레임이 같은 이름을 예시로 되풀이해 쓸 뿐이다.
const UNASSIGNED_MEMBERS: DataRow[] = [
  { id: 'M-09', name: '정하늘', major: '컴퓨터학부', grade: '3학년' },
  { id: 'M-10', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
]

export const FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 미배정 구성원은 이름으로 거른다. 조직도를 고치는 화면(ORG-03B)의 오른쪽 칸이다.
  'org.unassignedMembers': ({ query = '' }) =>
    UNASSIGNED_MEMBERS.filter((row) => matchesQuery(row, query)),
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
  'task.detail': ({ taskId = '' }) => {
    const detail = taskDetailOf(taskId)
    return detail === undefined ? [] : [detail]
  },
  'task.referenceDocuments': ({ taskId = '' }) => TASK_REFERENCE_DOCUMENTS[taskId] ?? [],
  'task.workDocuments': ({ taskId = '' }) => TASK_WORK_DOCUMENTS[taskId] ?? [],
  'task.reviewStatus': ({ taskId = '' }) =>
    taskDetailOf(taskId) === undefined
      ? []
      : [TASK_REVIEW_STATUS[taskId] ?? TASK_REVIEW_NOT_SUBMITTED],
  // 요청 id가 비면 새 요청이다 — 없는 것이 아니라 아직 안 적힌 것이다.
  'finance.purchaseRequestDraft': ({ requestId = '' }) =>
    requestId === ''
      ? [NEW_PURCHASE_REQUEST]
      : PURCHASE_REQUEST_DRAFTS[requestId]
        ? [PURCHASE_REQUEST_DRAFTS[requestId]]
        : [],
  'finance.purchaseRequestDetail': ({ requestId = '' }) =>
    PURCHASE_REQUEST_DETAILS[requestId] ? [PURCHASE_REQUEST_DETAILS[requestId]] : [],
  'finance.purchaseRequestItems': ({ requestId = '' }) =>
    PURCHASE_REQUEST_RESULTS[requestId] ?? [],
  'finance.paymentEvidenceSummary': ({ requestId = '' }) => {
    const row = PAYMENT_EVIDENCE_SUMMARIES[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.paymentEvidences': ({ requestId = '' }) => PAYMENT_EVIDENCES[requestId] ?? [],
  'finance.purchaseOrderSummary': ({ requestId = '' }) => {
    const row = PURCHASE_ORDER_SUMMARIES[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.purchaseOrders': ({ requestId = '' }) => PURCHASE_ORDERS[requestId] ?? [],
  'finance.reviewSummary': ({ requestId = '' }) => {
    const row = REVIEW_SUMMARIES[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.reviewItems': ({ requestId = '' }) => REVIEW_ITEMS[requestId] ?? [],
  'finance.supplementRequest': ({ requestId = '' }) => {
    const row = SUPPLEMENT_REQUESTS[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.supplementItems': ({ requestId = '' }) => SUPPLEMENT_ITEMS[requestId] ?? [],
  'finance.supplementInputFields': ({ itemId = '' }) => SUPPLEMENT_INPUT_FIELDS[itemId] ?? [],
  'finance.supplementAttachments': ({ itemId = '' }) => SUPPLEMENT_ATTACHMENTS[itemId] ?? [],
  'event.myPurchaseRequests': ({ eventId = '' }) => MY_PURCHASE_REQUESTS[eventId] ?? [],
  'event.myPurchaseRequestSummary': ({ eventId = '' }) => {
    const row = MY_PURCHASE_REQUEST_SUMMARY[eventId]
    return row === undefined ? [] : [row]
  },
  'finance.purchaseRequestHistory': ({ requestId = '' }) =>
    PURCHASE_REQUEST_HISTORY[requestId] ?? [],
  'my.tasks': ({ tab = 'todo', query = '' }) =>
    MY_TASKS.filter((task) => task.tab === tab)
      .map((task) => task.row)
      .filter((row) => matchesQuery(row, query)),
}


