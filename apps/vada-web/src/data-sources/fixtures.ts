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
        meetingId: 'MTG-01',
        detailKind: 'done',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
      },
      {
        meetingId: 'MTG-02',
        detailKind: 'scheduled',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
      },
      {
        meetingId: 'MTG-03',
        detailKind: 'scheduled',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
      },
    ],
  },
  {
    title: '2026 소프트웨어융합대학 체육대회',
    nextMeetingNote: '가장 가까운 회의: 07.18 (토) 10:00',
    meetings: [
      {
        meetingId: 'MTG-04',
        detailKind: 'live',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
      },
      {
        meetingId: 'MTG-05',
        detailKind: 'scheduled',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
      },
    ],
  },
  {
    title: '신입생 환영 행사',
    nextMeetingNote: '가장 가까운 회의: 07.15 (수) 16:00',
    meetings: [
      {
        meetingId: 'MTG-06',
        detailKind: 'tidying',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
      },
    ],
  },
  {
    title: '가을 축제',
    nextMeetingNote: '가장 가까운 회의: 08.05 (수) 13:00',
    meetings: [
      {
        meetingId: 'MTG-07',
        detailKind: 'cancelled',
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
        // 보는 사람과 이 회의의 관계. 지금 보는 사람은 일반 참가자라
        // 아무 딱지도 붙지 않는다 - 진행 권한자에게는 '진행 권한'이 온다.
        viewerChipLabel: '',
        viewerChipTone: '',
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
      hasDocuments: false,
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
      hasDocuments: false,
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
      hasDocuments: true,
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
      hasDocuments: true,
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
      hasDocuments: false,
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
      hasDocuments: true,
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
      hasDocuments: true,
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
      // EVT-05가 '담당자 김바다'를 그린다. event.workspace.host는
      // '담당 학술체육부 · 김바다'로 이어 오므로 다른 조각이다.
      host: '김바다',
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
  // 아직 아무것도 정하지 않은 행사. **없는 것이 아니라 비어 있다** — 행사는
  // 만들어졌고 채워지지 않았을 뿐이라, 화면이 '못 찾았다'가 아니라 '미입력'을
  // 그린다.
  //
  // **비어 있다는 말도 서버가 완성해서 준다.** 화면이 빈 문자열을 보고 '미입력'을
  // 지어내면 그 말이 코드에 박히고, 조직마다 다르게 부르는 자리가 된다.
  'E-03': {
    briefing: {
      headline: '아직 기본 정보를 입력하지 않았습니다. 일시와 장소를 정하면 모집을 시작할 수 있습니다.',
      stateNote: '현재 상태: 준비 중 · 다음 운영 단계는 기본 정보 입력입니다.',
    },
    highlights: {
      unassignedTasks: '0건',
      unassignedTasksDetail: '아직 만들어진 업무가 없습니다',
      needsCheck: '0명',
      needsCheckDetail: '확인할 신청자가 없습니다',
      nextMilestone: '기본 정보 입력',
      nextMilestoneDetail: '아직 담당자가 없습니다',
    },
    basics: {
      title: '2026 신입생 환영 행사',
      startAt: '미입력',
      place: '미입력',
      audience: '미입력',
      fee: '미정',
      capacity: '미정',
      contact: '미입력',
      host: '미지정',
    },
    recruitSettings: {
      surveyStatus: '초안',
      period: '미입력',
      method: '미정',
      applicantCount: '0명',
    },
    participantStats: {
      applicants: '0명',
      applicantsNote: '정원 미정',
      paid: '0명',
      paidNote: '미납 0명',
      needsCheck: '0명',
      needsCheckNote: '명단 불일치',
      unassignedTasks: '0개',
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
      targetKind: 'participants',
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
      targetKind: 'tasks',
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
    // 그려지지 않는 열쇠. 갈피가 어느 화면으로 갈지를 이 값이 정한다 —
    // 상태의 이름은 서버가 주는 말이라 명세가 들 수 없다.
    statusKey: 'planning',
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

// ─── 후속 정리 중인 행사(EVT-02D) ───────────────────────────────────────────
//
// **E-01과 같은 행사일 수 없다.** 한 행사가 두 상태일 수 없고(EVT-02는 이 행사를
// 기획 중으로 그린다), 두 화면이 같은 조각을 다르게 그린다 - 일시가 EVT-02에서는
// '08. 20. (목) 10:00'이고 EVT-02D에서는 '2026. 08. 20 10:00'이다. 회의 계열이
// 상태마다 회의를 하나씩 둔 것과 같은 자리다(docs/decisions/meeting-model.md).
//
// 머리와 문서·회의는 E-01의 것을 그대로 쓴다. **지어내지 않는다** - 와이어프레임은
// EVT-02C·02D·02E의 상태 딱지를 전부 '기획 중'으로 그렸고, 후속 정리 중인 행사의
// 문서·회의를 다시 그린 프레임은 없다.
const WRAP_UP_EVENT = 'E-02'

const carriedOver = <Row extends { eventId: string }>(rows: Row[]): Row[] =>
  rows
    .filter((row) => row.eventId === 'E-01')
    .map((row) => ({ ...row, eventId: WRAP_UP_EVENT }))

// 끝나지 않은 업무가 곧 후속 정리의 남은 항목이다. 두 벌로 적으면 한쪽만 고쳐진다.
//
// **줄의 id는 E-01의 것을 그대로 쓴다.** taskDetailOf가 행사를 묻지 않고 id로만
// 찾으므로, 이름을 바꾸면 E-02의 업무를 눌렀을 때 상세가 없다고 나온다.
EVENT_TASK_BOARD.push(
  ...carriedOver(EVENT_TASK_BOARD).filter((task) => task.status !== 'done'),
)
EVENT_DOCUMENTS.push(...carriedOver(EVENT_DOCUMENTS))
EVENT_MEETINGS.push(...carriedOver(EVENT_MEETINGS))
EVENT_DOCUMENT_STATS[WRAP_UP_EVENT] = EVENT_DOCUMENT_STATS['E-01']
EVENT_MEETING_COUNTS[WRAP_UP_EVENT] = EVENT_MEETING_COUNTS['E-01']
EVENT_WORKSPACES[WRAP_UP_EVENT] = {
  ...EVENT_WORKSPACES['E-01'],
  // **단계가 다르다.** 이 열쇠가 '개요' 갈피를 정리 화면으로 보낸다.
  statusKey: 'wrapUp',
}
EVENT_SUMMARIES[WRAP_UP_EVENT] = EVENT_SUMMARIES['E-01']

// 기본 정보는 EVT-02D가 그린 것만 다르다. 나머지는 같은 행사의 값이라 그대로다.
EVENT_OVERVIEW[WRAP_UP_EVENT] = {
  ...EVENT_OVERVIEW['E-01'],
  basics: {
    ...EVENT_OVERVIEW['E-01'].basics,
    startAt: '2026. 08. 20 10:00',
    // 행사가 끝나야 셀 수 있는 값이라 이 단계부터 온다. 아직 세지 않았다.
    attendeeCount: '집계 전',
  },
}

// 단계 줄과 띠. **상태 이름도 권한 안내도 서버가 준다** - 명세가 들면 단계가 하나
// 늘거나 권한이 바뀔 때 명세가 틀린다.
const EVENT_WRAP_UP_BANNER: Record<string, DataRow> = {
  [WRAP_UP_EVENT]: {
    stateLabel: '후속 정리 중',
    stateTone: 'orange',
    permissionNote: '행사 완료 처리는 회장단만 할 수 있습니다.',
    headline: '행사는 종료되었으며 후속 정리가 진행 중입니다.',
    note: '남은 업무와 기록을 확인한 후 행사를 완료 처리할 수 있습니다.',
    tone: 'orange',
  },
}

// 타일 넷. 넷이라는 것은 명세가 정하고 값과 색만 여기서 온다.
const EVENT_WRAP_UP_COUNTS: Record<string, DataRow> = {
  [WRAP_UP_EVENT]: {
    unfinishedTasks: '6건',
    unfinishedTasksTone: 'red',
    unorganizedDocs: '0건',
    unorganizedDocsTone: 'orange',
    unwrittenMinutes: '0건',
    unwrittenMinutesTone: 'yellow',
    needsCheck: '0명',
    needsCheckTone: 'green',
  },
}

// 남은 항목. id는 줄에 그려지지 않지만 그 원본을 가리킨다 - 업무 보드의 업무와
// 같은 것이므로 id를 맞춘다(재정 보드가 요청 id를 맞춘 것과 같은 규칙).
const EVENT_WRAP_UP_REMAINING: Record<string, DataRow[]> = {
  [WRAP_UP_EVENT]: [
    {
      id: 'T-01',
      title: '참가자 모집 공지 작성',
      detail: '홍보부 · 이윤슬 · 07. 20까지',
      tone: 'gray',
    },
    {
      id: 'T-03',
      title: '현수막 디자인 수정 반영',
      detail: '홍보부 · 이윤슬 · 07. 18까지 · 지연',
      tone: 'red',
    },
    {
      id: 'T-07',
      title: '물품 구매 요청',
      detail: '운영부 · 박해랑 · 07. 25까지',
      tone: 'gray',
    },
    {
      id: 'T-05',
      title: '행사장 안전 점검',
      detail: '운영부 · 담당자 배정 필요 · 08. 18까지',
      tone: 'gray',
    },
    {
      id: 'T-06',
      title: '참가자 명단 최종 확정',
      detail: '기획부 · 담당자 배정 필요 · 08. 10까지',
      tone: 'gray',
    },
    {
      id: 'T-08',
      title: '행사 안전 안내문 검토',
      detail: '기획부 · 박해랑 · 07. 22까지',
      tone: 'gray',
    },
  ],
}

// ─── 기록 · 완료된 행사와 아카이브(REC-01 · REC-02 · REC-02A) ────────────────
//
// EVENT_WRAP_UP_* 묶음 **바로 아래**에 둔다. 그 자리가 'E-01의 것을 물려받아 다른
// 상태의 행사를 만드는' 패턴이 이미 있는 곳이고, 여기서도 같은 것을 한다.
//
// 완료된 행사는 event.list에 오지 않는다(카탈로그가 그렇게 적어 두었다). 그래서
// 별도 id를 쓰고, **아카이브의 근거 자료가 원본 화면으로 데려가므로** 그 행사의
// 업무·회의·문서·정산이 실제로 있어야 한다 — E-01의 것을 물려받고 이름만 아카이브가
// 말하는 것으로 바꾼다. 두 벌로 적으면 갈린다(재정 보드의 PR-01 사고와 같은 계급).

const ARCHIVED_EVENTS: Array<{ id: string; title: string }> = [
  { id: 'E-REC-01', title: '봄 축제 학생회 부스' },
  { id: 'E-REC-02', title: '2025 학년도 종강 행사' },
]

const carriedToArchive = <Row extends { eventId: string }>(
  rows: Row[],
  eventId: string,
): Row[] =>
  rows.filter((row) => row.eventId === 'E-01').map((row) => ({ ...row, eventId }))

for (const event of ARCHIVED_EVENTS) {
  EVENT_TASK_BOARD.push(...carriedToArchive(EVENT_TASK_BOARD, event.id))
  EVENT_DOCUMENTS.push(...carriedToArchive(EVENT_DOCUMENTS, event.id))
  EVENT_MEETINGS.push(...carriedToArchive(EVENT_MEETINGS, event.id))
  EVENT_DOCUMENT_STATS[event.id] = EVENT_DOCUMENT_STATS['E-01']
  EVENT_MEETING_COUNTS[event.id] = EVENT_MEETING_COUNTS['E-01']
  EVENT_FINANCE_SUMMARY[event.id] = EVENT_FINANCE_SUMMARY['E-01']
  EVENT_FINANCE_ALERTS[event.id] = EVENT_FINANCE_ALERTS['E-01']
  EVENT_WORKSPACES[event.id] = { ...EVENT_WORKSPACES['E-01'], status: '완료', statusTone: 'gray' }
  EVENT_SUMMARIES[event.id] = { ...EVENT_SUMMARIES['E-01'], title: event.title }
  EVENT_OVERVIEW[event.id] = EVENT_OVERVIEW['E-01']
}

// 목록의 머리. 몇 건이 미발행인지는 서버가 세고 화면은 그 문구만 그린다 —
// 검색으로 목록이 걸러져도 이 수는 걸러지지 않는다.
const COMPLETED_EVENT_ALERT: DataRow = { unpublishedNote: '인수인계 문서 미발행 2건' }

// 셋이 저마다 다른 단계다. **셋째에는 actionLabel이 오지 않고 blockedNote가 대신
// 온다** — 갈 곳이 없는 항목에는 그 문구가 오지 않는다는 규칙(event.checklist의
// actionLabel·targetKind와 같은 자리).
const COMPLETED_EVENTS: DataRow[] = [
  {
    id: 'E-REC-01',
    statusLabel: '완료',
    archiveStatus: '발행 v1.0',
    archiveStatusTone: 'green',
    title: '봄 축제 학생회 부스',
    date: '2026. 05. 28',
    host: '대외협력부',
    highlights: [
      { label: '186명 참석 (신청 210명)' },
      { label: '예산 집행 92%' },
      { label: '완료 업무 14건' },
    ],
    completedNote: '완료 처리 2026. 06. 04',
    actionLabel: '상세 보기 →',
    // 발행된 문서는 읽는 화면으로 간다.
    targetKind: 'published',
  },
  {
    id: 'E-REC-02',
    statusLabel: '완료',
    archiveStatus: '검토 중',
    archiveStatusTone: 'blue',
    title: '2025 학년도 종강 행사',
    date: '2025. 12. 19',
    host: '학술체육부',
    highlights: [
      { label: '320명 참석 (신청 356명)' },
      { label: '예산 집행 88%' },
      { label: '완료 업무 21건' },
    ],
    completedNote: '완료 처리 2026. 01. 07',
    actionLabel: '상세 보기 →',
    // **아직 발행되지 않았으므로 쓰고 검토받는 화면으로 간다.** 그것이 REC-02A로
    // 들어가는 문이다 — 그 전에는 주소로만 열렸다.
    targetKind: 'draft',
  },
  {
    id: 'E-REC-03',
    statusLabel: '완료',
    archiveStatus: '인수인계 문서 미발행',
    archiveStatusTone: 'gray',
    title: '2025 신입생 환영회',
    date: '2025. 03. 14',
    host: '홍길동',
    highlights: [
      { label: '210명 참석 (신청 240명)' },
      { label: '예산 집행 95%' },
      { label: '완료 업무 9건' },
    ],
    completedNote: '완료 처리 2025. 03. 28',
    blockedNote: '인수인계 문서가 아직 발행되지 않았습니다',
  },
]

// 문서 자체. 발행 전에도 있다 — 쓰는 화면은 이름과 상태만 읽는다.
const ARCHIVE_AI_DISCLAIMER =
  'AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다. 생성 후 반드시 검토·수정해 확정하세요.'

const RECORD_ARCHIVES: Record<string, DataRow> = {
  'E-REC-01': {
    title: '봄 축제 학생회 부스',
    statusLabel: '발행 v1.0',
    statusTone: 'green',
    scheduleNote: '2026. 05. 28 (목) 11:00–17:00',
    ownerNote: '대외협력부 · 책임자 이윤슬',
    publishedNote: '발행 2026. 06. 04',
    authorNote: '작성 이윤슬',
    reviewerNote: '검토 김바다 (회장단)',
    nextOwnerNote: '다음 담당: 대외협력부 부서장',
  },
  // 아직 발행되지 않은 문서. **본문은 E-REC-01의 것을 그대로 쓴다** — 검토 중인
  // 아카이브를 따로 그린 프레임이 없으므로 지어내지 않는다.
  'E-REC-02': {
    title: '2025 학년도 종강 행사',
    statusLabel: '검토 중',
    statusTone: 'blue',
    scheduleNote: '2025. 12. 19 (금) 18:00–21:00',
    ownerNote: '학술체육부 · 책임자 김바다',
    nextOwnerNote: '다음 담당: 학술체육부 부서장',
  },
  // 아직 아무것도 쓰지 않은 문서(REC-02A가 여는 그것).
  'E-REC-03': {
    title: '2025 신입생 환영회',
    statusLabel: '인수인계 문서 미발행',
    statusTone: 'gray',
    aiDisclaimer: ARCHIVE_AI_DISCLAIMER,
  },
}

// 목차. 발행된 문서는 회고가 세 갈래로 펴지고, 쓰는 중인 문서는 절마다 어디까지
// 왔는지가 함께 온다. 같은 목록을 두 화면이 다르게 그린다.
const PUBLISHED_SECTIONS: DataRow[] = [
  { key: 'overview', label: '개요' },
  { key: 'outcome', label: '성과' },
  { key: 'timeline', label: '타임라인' },
  { key: 'onSite', label: '현장 운영' },
  { key: 'evidence', label: '근거 자료' },
  {
    key: 'retro',
    label: '회고',
    rows: [
      { key: 'retroGood', label: '잘된 점' },
      { key: 'retroIssues', label: '미흡했던 점' },
      { key: 'retroImprovements', label: '개선안' },
    ],
  },
  { key: 'handover', label: '인수인계' },
]

const DRAFT_SECTIONS: DataRow[] = [
  { key: 'overview', label: '개요', statusLabel: '자동', statusTone: 'gray' },
  { key: 'outcome', label: '성과', statusLabel: '자동', statusTone: 'gray' },
  { key: 'timeline', label: '타임라인', statusLabel: '자동', statusTone: 'gray' },
  { key: 'evidence', label: '근거 자료', statusLabel: '자동', statusTone: 'gray' },
  { key: 'onSite', label: '현장 운영', statusLabel: '작성 전', statusTone: 'orange' },
  { key: 'retro', label: '회고', statusLabel: '작성 전', statusTone: 'orange' },
  { key: 'handover', label: '인수인계', statusLabel: '작성 전', statusTone: 'orange' },
]

const RECORD_ARCHIVE_SECTIONS: Record<string, DataRow[]> = {
  'E-REC-01': PUBLISHED_SECTIONS,
  'E-REC-02': PUBLISHED_SECTIONS,
  'E-REC-03': DRAFT_SECTIONS,
}

// 라벨이 고정된 열세 조각. 값만 서버가 준다.
const ARCHIVE_DETAIL: DataRow = {
  goal: '재학생 교류 확대와 학생회 활동 홍보',
  audience: '소프트웨어융합대학 재학생 전체',
  scheduleAndPlace: '2026. 05. 28 11:00–17:00 · 한양대 ERICA 잔디밭',
  owner: '대외협력부 · 이윤슬',
  scale: '부스 4개 · 운영 인력 12명 · 참석 186명',
  attendance: '신청 210명 → 참석 186명 (88.6%)',
  satisfaction: '설문 응답 142건 · 긍정 89%',
  budget: '계획 1,200,000원 → 집행 1,104,000원 (92%)',
  taskCompletion: '전체 14건 완료 · 지연 2건',
  runOrder: '09:00 설치 → 11:00 개장 → 14:00 경품 추첨 → 16:30 정리 → 17:00 철수',
  staffing: '부스별 2명 · 안내 2명 · 물품 관리 1명 · 총괄 1명',
  incident: '13시경 강풍으로 배너 2개 전도. 즉시 고정 추가 후 재설치',
  operationChange: '대기 인원이 몰려 경품 추첨을 30분 앞당김',
}

const ARCHIVE_TIMELINE: DataRow[] = [
  { id: 'T-1', date: '04. 12', title: '기획 확정', description: '부스 4종 구성과 예산 규모를 운영회의에서 승인' },
  { id: 'T-2', date: '04. 26', title: '주요 의사결정', description: '우천 대비 실내 대체 장소를 학생회관 1층으로 확정' },
  { id: 'T-3', date: '05. 08', title: '업무 지연', description: '현수막 제작이 업체 사정으로 5일 지연 · 대체 업체로 변경' },
  { id: 'T-4', date: '05. 20', title: '일정 변경', description: '종료 시각을 16:00 → 17:00으로 연장' },
  { id: 'T-5', date: '05. 28', title: '행사 진행', description: '부스 4개 정상 운영 · 참석 186명' },
  { id: 'T-6', date: '06. 04', title: '행사 종료·정산', description: '정산 완료 및 완료 처리' },
]

// 갈 곳은 데이터가 준 열쇠(targetKind)로 명세가 정한다. 데이터가 화면 이름을
// 직접 주면 검증기가 그 화면이 있는지 확인할 수 없다.
const ARCHIVE_EVIDENCE: DataRow[] = [
  { id: 'EV-1', title: '행사 업무', detail: '14건 (완료 12 · 지연 2)', actionLabel: '원본 보기 →', targetKind: 'tasks' },
  { id: 'EV-2', title: '관련 회의', detail: '3건 · 결정 5건', actionLabel: '원본 보기 →', targetKind: 'meetings' },
  { id: 'EV-3', title: '행사 문서', detail: '8건 (사양서·시안·정산 근거)', actionLabel: '원본 보기 →', targetKind: 'documents' },
  { id: 'EV-4', title: '정산', detail: '구매 요청 6건 · 집행 1,104,000원', actionLabel: '원본 보기 →', targetKind: 'finance' },
]

const ARCHIVE_RETRO: DataRow[] = [
  {
    groupLabel: '잘된 점',
    rows: [
      { key: 'G-1', label: '부스별 담당자를 미리 2명씩 배치해 공백이 없었다' },
      { key: 'G-2', label: '우천 대비 장소를 사전에 확정해 당일 혼선이 없었다' },
    ],
  },
  {
    groupLabel: '미흡했던 점',
    rows: [
      { key: 'B-1', label: '현수막 제작이 5일 지연됐다', causeNote: '원인 · 업체 확정을 행사 3주 전에 시작했다' },
      { key: 'B-2', label: '경품 대기 줄 관리가 미흡했다', causeNote: '원인 · 대기 동선을 사전에 정하지 않았다' },
    ],
  },
  {
    groupLabel: '다음 행사 개선안',
    rows: [
      { key: 'I-1', label: '제작물 업체는 행사 6주 전까지 확정한다', ownerLabel: '홍보부' },
      { key: 'I-2', label: '대기 인원이 몰리는 프로그램은 동선과 번호표를 사전에 준비한다', ownerLabel: '운영부' },
    ],
  },
]

// 주의사항만 색 이름을 갖는다 — 나머지 줄은 무채색이다.
const ARCHIVE_HANDOVER: DataRow[] = [
  {
    groupLabel: '재사용 자산',
    rows: [
      { key: 'A-1', label: '· 부스 배치도 (재사용 가능)' },
      { key: 'A-2', label: '· 참가 안내 포스터 원본 파일' },
      { key: 'A-3', label: '· 경품 수령 확인 서식' },
    ],
  },
  {
    groupLabel: '협력처·담당자',
    rows: [
      { key: 'P-1', label: '현수막 제작', value: '한빛기획 · 031-000-0000' },
      { key: 'P-2', label: '경품 납품', value: '새봄상사 · 031-111-1111' },
    ],
  },
  {
    groupLabel: '주의사항',
    rows: [
      { key: 'C-1', label: '⚠ 잔디밭 사용은 총무처 사전 승인이 필요하다 (2주 소요)', tone: 'orange' },
      { key: 'C-2', label: '⚠ 강풍 시 배너 고정 추가가 필수다', tone: 'orange' },
    ],
  },
]

const ARCHIVE_CHECKLIST: DataRow[] = [
  {
    groupLabel: '대외협력부',
    rows: [
      { key: 'K-1', label: '장소 사용 승인 절차 확인', done: 'false' },
      { key: 'K-2', label: '협력처 연락처 갱신', done: 'false' },
    ],
  },
  {
    groupLabel: '홍보부',
    rows: [
      { key: 'K-3', label: '제작물 일정 6주 전 착수', done: 'false' },
      { key: 'K-4', label: '포스터 원본 파일 인수', done: 'false' },
    ],
  },
  {
    groupLabel: '운영부',
    rows: [
      { key: 'K-5', label: '대기 동선 계획 수립', done: 'false' },
      { key: 'K-6', label: '현장 물품 목록 점검', done: 'false' },
    ],
  },
]

// 쓰는 중인 아카이브(REC-02A). 자동으로 채워지는 넷과 사람이 쓰는 칸이 갈린다.
const ARCHIVE_AUTO_FILLED: Record<string, DataRow> = {
  'E-REC-03': {
    overview: '2025 신입생 환영회 · 2025. 03. 14 · 담당 홍길동 · 책임자 홍길동 · 210명 참석 (신청 240명)',
    outcome: '210명 참석 (신청 240명) · 예산 집행 95% · 완료 업무 9건',
    timeline: '행사 2025. 03. 14 → 완료 처리 2025. 03. 28 · 참석자 210명 · 참여 설문 완료',
    evidence: '완료 업무 9건 · 회의·문서·구매 연결 데이터 없음',
  },
}

// 아직 아무것도 쓰지 않았다. 조각이 통째로 오지 않는 것과 빈 글이 오는 것은 다르다 —
// 여기서는 아직 적힌 적이 없으므로 오지 않는다.
const ARCHIVE_DRAFTS: Record<string, DataRow> = {
  'E-REC-03': {},
}

// 여섯 조건. **무엇이 조건인지도 서버가 준다** — 명세가 조건을 들면 문서 서식이
// 바뀔 때마다 명세가 틀린다.
const ARCHIVE_GATE_CONDITIONS: DataRow[] = [
  { key: 'C-1', label: '현장 운영 기록', met: 'false', tone: 'orange' },
  { key: 'C-2', label: '회고 · 잘된 점', met: 'false', tone: 'orange' },
  { key: 'C-3', label: '회고 · 미흡했던 점과 원인', met: 'false', tone: 'orange' },
  { key: 'C-4', label: '회고 · 다음 행사 개선안', met: 'false', tone: 'orange' },
  { key: 'C-5', label: '인수인계 내용', met: 'false', tone: 'orange' },
  { key: 'C-6', label: '다음 담당자 지정', met: 'false', tone: 'orange' },
]

const ARCHIVE_GATE: Record<string, DataRow> = {
  'E-REC-03': {
    metCountNote: '0 / 6',
    blockedNote:
      '직접 작성하는 부분(현장 운영·회고·인수인계)을 모두 채워야 검토를 요청할 수 있습니다',
  },
}

// 아직 검토되지 않았다. 의견이 없으면 조각이 오지 않고, 그 자리를 말하는 것은
// 출처의 messages.empty다.
const ARCHIVE_REVIEWS: Record<string, DataRow> = {
  'E-REC-03': {},
}

// ─── 행사 참석 확인 QR(EVT-04B) ─────────────────────────────────────────────
//
// **행사 상태와 따로 켜고 끈다.** 기획 중인 E-01의 QR은 켜져 있고 후속 정리 중인
// E-02의 것은 꺼져 있다 — 행사가 어느 단계냐로는 이 값을 유도할 수 없다.
//
// **아직 만들지 않은 행사가 있다.** 카탈로그가 '아직 만들어진 QR이 없습니다'를
// 들고 있는 것이 그 자리이고, 아직 조직도 세우지 않은 E-03이 그렇다.
const EVENT_ATTENDANCE_QR: Record<string, DataRow> = {
  'E-01': {
    statusLabel: '활성 중',
    statusTone: 'green',
    // 체크인 시간대는 **09:30 ~ 11:00**이다(사람이 정한 것). 행사 자체는 10:00~14:00
    // 이고 체크인은 그 앞 한 시간 반이다 — 두 값은 다른 것이며 어긋난 것이 아니다.
    //
    // 와이어프레임은 이 자리를 **빈 DateTime Picker 둘**로 그렸다(25:398·25:402).
    // 그린 값이 없으므로 대조가 강제하는 것도 없고, 여기 적힌 것은 처음부터
    // 개발용으로 지어낸 값이었다. 한동안 '그림 둘이 어긋난다'로 적혀 있었는데
    // 어긋난 것은 그림이 아니라 **그림과 이 파일**이었다.
    startAt: '2026. 08. 20 09:30',
    endAt: '2026. 08. 20 11:00',
    guideNote:
      '참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.',
    fileName: '2026-체육대회-참석확인-QR.png',
  },
  'E-02': {
    statusLabel: '비활성',
    statusTone: 'gray',
    startAt: '2026. 05. 28 11:00',
    endAt: '2026. 05. 28 17:00',
    guideNote:
      '참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.',
    fileName: '봄축제-부스-참석확인-QR.png',
  },
}

// ─── QR 참석 확인(EXT-01A · EXT-01B) ────────────────────────────────────────
//
// **열쇠가 행사가 아니라 토큰이다.** 위의 EVENT_ATTENDANCE_QR은 학생회 사람이 행사로
// 찾는 것이고, 이 둘은 밖에서 온 사람이 QR로 찾는 것이다. QR은 껐다 켜고 다시 만들 수
// 있으므로(EVT-04B의 재생성·비활성화) 같은 행사라도 토큰이 갈린다.
//
// **토큰을 여섯 둔다.** 하나만 두면 '토큰마다 다르다'가 말뿐이 되고, 결과가 여섯인데
// 몇만 두면 **회색 둘이 시계와 X로 갈린다**는 사실이 드러나지 않는다.
//
// **체크인 시간대는 09:30 ~ 11:00이다.** 이 글은 EXT-01A가 실제로 그린 것이고,
// EVENT_ATTENDANCE_QR의 시각도 이제 여기에 맞췄다 — 저쪽은 그림이 빈 DateTime
// Picker라 그린 값이 없었고, 어긋나 보이던 10:00~14:00은 지어낸 개발용 값이었다.
const SPORTS_CHECK_IN: DataRow = {
  eventName: '2026 소프트웨어융합대학 체육대회',
  statusLabel: '체크인 가능',
  statusTone: 'green',
  checkInWindow: '09:30 ~ 11:00',
  guideNote: '참가 신청 시 입력한 이름과 학번을 정확히 입력해 주세요.',
}

const ATTENDANCE_CHECK_IN_FORM: Record<string, DataRow> = {
  // 열리는 넷. 명단에 있는지·이미 냈는지·조건을 채웠는지는 내 봐야 안다.
  A7K2M9: { ...SPORTS_CHECK_IN },
  B3N8P4: { ...SPORTS_CHECK_IN },
  C5Q1R6: { ...SPORTS_CHECK_IN },
  D8W4X2: { ...SPORTS_CHECK_IN },
  // 열자마자 막히는 둘. blocked 셋은 함께 오고, 오면 이름·학번 칸을 그리지 않는다.
  E2Y7Z5: {
    ...SPORTS_CHECK_IN,
    statusLabel: '체크인 시간 아님',
    statusTone: 'gray',
    blockedLabel: '체크인 시간 전·후',
    blockedTone: 'gray',
    blockedNote: '체크인 가능 시간이 아닙니다. (09:30 ~ 11:00)',
  },
  F6H1J3: {
    eventName: '봄 축제 학생회 부스',
    statusLabel: '비활성',
    statusTone: 'gray',
    checkInWindow: '2026. 05. 28 11:00 ~ 17:00',
    guideNote: '참가 신청 시 입력한 이름과 학번을 정확히 입력해 주세요.',
    blockedLabel: '비활성화된 QR',
    blockedTone: 'gray',
    blockedNote: '이 QR은 더 이상 사용할 수 없습니다.',
  },
}

// 결과 여섯. **글은 와이어프레임이 카드마다 그린 것을 그대로 옮겼다** — 대조가 그 글을
// 지킨다. 회색 둘(clock·x)이 이 표의 값이다.
// canRetry는 **서버의 판정**이다. 이름이 명단과 다를 때만 다시 내는 것이 뜻이
// 있다 — 참석이 이미 끝났거나 QR이 꺼진 결과에서는 다시 내도 같은 답이 온다.
// 화면은 이 값만 보고 '다시 입력'을 그릴지 정한다(EXT-01B의 drawnWhen).
// **열쇠가 영수증이다.** 낼 때 서버가 사람마다 다른 값을 돌려주고 결과는 그것으로
// 찾는다 — QR의 토큰으로 찾으면 같은 QR을 찍은 여러 사람이 서로의 이름과 결과를
// 본다. 여기 여섯은 여섯 가지 결과를 보여 주려고 둔 것이고, 진짜 서버라면
// 낸 횟수만큼 있다.
const ATTENDANCE_CHECK_IN_RESULT: Record<string, DataRow> = {
  'RCPT-A7K2M9': {
    label: '참석 완료',
    tone: 'green',
    iconName: 'check',
    description: '2026. 08. 20 09:47 체크인되었습니다.',
    canRetry: false,
  },
  'RCPT-B3N8P4': {
    label: '참가자 명단 불일치',
    tone: 'yellow',
    iconName: 'circle-alert',
    description: '입력하신 정보가 명단에 없습니다. 운영진에게 문의해 주세요.',
    canRetry: true,
  },
  'RCPT-C5Q1R6': {
    label: '이미 참석 처리됨',
    tone: 'blue',
    iconName: 'info',
    description: '이미 참석 확인이 완료된 상태입니다.',
    canRetry: false,
  },
  'RCPT-D8W4X2': {
    label: '조건 미충족',
    tone: 'red',
    iconName: 'x',
    description: '참가비 미납 또는 신청 미완료 상태입니다.',
    canRetry: false,
  },
  'RCPT-E2Y7Z5': {
    label: '체크인 시간 전·후',
    tone: 'gray',
    iconName: 'clock',
    description: '체크인 가능 시간이 아닙니다. (09:30 ~ 11:00)',
    canRetry: false,
  },
  'RCPT-F6H1J3': {
    label: '비활성화된 QR',
    tone: 'gray',
    iconName: 'x',
    description: '이 QR은 더 이상 사용할 수 없습니다.',
    canRetry: false,
  },
}

// ─── 행사 기본정보 편집 초안(EVT-02B) ───────────────────────────────────────
//
// event.basics와 **다른 조각이다.** 저기는 그려진 한 줄('납부자 무료 / 미납자
// 5000원')을 주고 이것은 고칠 칸 하나하나를 준다. 두 벌이 어긋나지 않도록 값은
// EVENT_OVERVIEW.basics와 EVENT_LIST에서 옮겼다.
//
// 비어 있는 칸은 아예 넣지 않는다 — 카탈로그가 optional로 두었고, 와이어프레임도
// 그 칸들을 안내 문구만 있는 빈 칸으로 그렸다.
const EVENT_BASICS_DRAFT: Record<string, DataRow> = {
  'E-01': {
    title: '2026 소프트웨어융합대학 체육대회',
    startAt: '2026-08-20T10:00',
    endAt: '2026-08-20T14:00',
    place: 'ERICA 체육관',
    address: '경기 안산시 상록구 한양대학로 55',
    audience: '소프트웨어융합대학 전체',
    feeType: 'duesConditional',
    paidAmount: '0',
    unpaidAmount: '5000',
    capacityType: 'limited',
    capacity: '200',
    hostDepartment: '학술체육부',
    hostPerson: '김바다',
    contact: '카카오톡 채널 @swcollege',
  },
  'E-02': {
    title: '봄 축제 학생회 부스',
    place: '한양대 ERICA 잔디밭',
    feeType: 'free',
    capacityType: 'unlimited',
    hostDepartment: '대외협력부',
  },
  // 아직 기본 정보를 채우지 않은 행사. 행사 목록이 그 줄에 '기본 정보 입력 필요'만
  // 그린 것이 이 상태다 — 유형 둘은 카탈로그가 늘 온다고 했으므로 '미정'으로 온다.
  'E-03': {
    title: '2026 신입생 환영 행사',
    feeType: 'undecided',
    capacityType: 'undecided',
  },
}

// ─── 참여 설문(EVT-05 · EVT-05B) ───────────────────────────────────────────
//
// 설문의 상태는 **행사의 상태와 다른 축이다.** E-01은 기획 중인데 그 설문은
// 초안이고, 신청자 142명은 event.recruitSettings가 이미 세고 있던 수다.
const EVENT_SURVEY: Record<string, DataRow> = {
  'E-01': {
    statusLabel: '초안',
    statusTone: 'gray',
    previewUrl: 'https://vada.app/s/2026-swcollege-sports/preview',
  },
  // **설문은 행사와 함께 생긴다.** 아직 아무것도 안 정한 행사에도 설문의 자리가
  // 있고, 그래서 EVT-05가 열린다 — EVT-04의 빈 참가자 명단이 권하는 곳이 여기다.
  // 이것이 없으면 그 단추가 터지는 화면으로 데려간다.
  'E-03': {
    statusLabel: '초안',
    statusTone: 'gray',
    previewUrl: 'https://vada.app/s/2026-freshman-welcome/preview',
  },
}

// 모집 설정 초안(EVT-05). 비어 있는 칸은 아예 넣지 않는다 — 카탈로그가 전부
// optional로 두었고, 와이어프레임도 신청 기간과 완료 안내를 빈 칸으로 그렸다.
const EVENT_SURVEY_SETTINGS_DRAFT: Record<string, DataRow> = {
  'E-01': {
    applyMethod: 'firstCome',
    duesCheck: 'y',
  },
  // 아무것도 안 정한 새 행사. **빈 한 줄이지 없는 것이 아니다** — 초안의 자리는
  // 있고 담긴 값이 없을 뿐이라, 화면이 '못 찾았다'가 아니라 빈 칸을 그린다.
  'E-03': {},
}

// 링크를 켤 수 있는지. **막는 것은 서버다** — 무엇이 모자란지를 화면이 세면
// 조직의 규칙이 화면에 적히게 된다(meeting.minutesProgress와 같은 자리).
const EVENT_SURVEY_ACTIVATION: Record<string, DataRow> = {
  // 새 행사는 채운 것이 거의 없다. **막는 것은 서버이므로 화면이 이 수를 세지
  // 않는다** — 세면 조직의 규칙이 화면에 적힌다.
  'E-03': {
    unmetCountNote: '미충족 12개',
    unmetCount: 12,
    canActivate: false,
    blockedNote: '아직 채우지 않은 활성화 조건이 12개 있습니다.',
  },
  'E-01': {
    unmetCountNote: '미충족 2개',
    unmetCount: 2,
    canActivate: false,
    blockedNote: '아직 채우지 않은 활성화 조건이 2개 있습니다.',
  },
}

// 채워야 하는 것들. 행사 기본정보에서 채울 것과 참여 설문에서 채울 것이 갈린다.
// 못 채운 둘의 수가 곧 위의 unmetCount이므로 여기서 세어도 같다.
const EVENT_SURVEY_ACTIVATION_CONDITIONS: Record<string, DataRow[]> = {
  'E-01': [
    {
      groupLabel: '행사 기본정보',
      rows: [
        { key: 'title', label: '행사명', met: 'y', tone: 'green' },
        { key: 'startAt', label: '시작 일시', met: 'y', tone: 'green' },
        { key: 'endAt', label: '종료 일시', met: 'y', tone: 'green' },
        { key: 'place', label: '장소', met: 'y', tone: 'green' },
        { key: 'audience', label: '참가 대상', met: 'y', tone: 'green' },
        { key: 'feeType', label: '참가비 유형', met: 'y', tone: 'green' },
        {
          key: 'feeAmounts',
          label: '납부자·미납자 금액·결제 안내',
          met: '',
          tone: 'red',
          detail: '금액과 결제 안내를 입력하세요',
          locationNote: '입력 위치: 행사 기본정보 → 참가비(학생회비 조건부)',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        { key: 'capacityType', label: '행사 정원 유형', met: 'y', tone: 'green' },
        { key: 'capacity', label: '정원 인원', met: 'y', tone: 'green' },
      ],
    },
    {
      groupLabel: '참여 설문 설정',
      rows: [
        {
          key: 'applyEnd',
          label: '신청 마감 일시',
          met: '',
          tone: 'red',
          detail: '신청 마감 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        { key: 'applyOrder', label: '신청 시작·마감 순서', met: 'y', tone: 'green' },
        { key: 'applyMethod', label: '신청 방식', met: 'y', tone: 'green' },
        { key: 'nameQuestion', label: '이름 필수 문항', met: 'y', tone: 'green' },
        { key: 'studentNoQuestion', label: '학번 필수 문항', met: 'y', tone: 'green' },
        { key: 'privacyConsent', label: '개인정보 수집·이용 동의', met: 'y', tone: 'green' },
        { key: 'duesIdentity', label: '학생회비 대조용 식별 문항', met: 'y', tone: 'green' },
      ],
    },
  ],
  // 새 행사. 채운 것이 넷뿐이라 나머지 열둘이 빨갛다 — 위의 unmetCount 12와 같은
  // 수다. 어디서 채우는지(locationNote·targetKind)는 조건마다 다르고 그것을 아는
  // 것은 서버다.
  'E-03': [
    {
      groupLabel: '행사 기본정보',
      rows: [
        { key: 'title', label: '행사명', met: 'y', tone: 'green' },
        {
          key: 'startAt',
          label: '시작 일시',
          met: '',
          tone: 'red',
          detail: '시작 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 일시',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'endAt',
          label: '종료 일시',
          met: '',
          tone: 'red',
          detail: '종료 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 일시',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'place',
          label: '장소',
          met: '',
          tone: 'red',
          detail: '장소가 입력되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 장소',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'audience',
          label: '참가 대상',
          met: '',
          tone: 'red',
          detail: '참가 대상이 입력되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 참가 대상',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'feeType',
          label: '참가비 유형',
          met: '',
          tone: 'red',
          detail: '참가비 유형이 정해지지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 참가비',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'capacityType',
          label: '행사 정원 유형',
          met: '',
          tone: 'red',
          detail: '정원 유형이 정해지지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 정원',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
      ],
    },
    {
      groupLabel: '참여 설문 설정',
      rows: [
        {
          key: 'applyStart',
          label: '신청 시작 일시',
          met: '',
          tone: 'red',
          detail: '신청 시작 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        {
          key: 'applyEnd',
          label: '신청 마감 일시',
          met: '',
          tone: 'red',
          detail: '신청 마감 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        {
          key: 'applyMethod',
          label: '신청 방식',
          met: '',
          tone: 'red',
          detail: '신청 방식이 정해지지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        { key: 'nameQuestion', label: '이름 필수 문항', met: 'y', tone: 'green' },
        { key: 'studentNoQuestion', label: '학번 필수 문항', met: 'y', tone: 'green' },
        { key: 'privacyConsent', label: '개인정보 수집·이용 동의', met: 'y', tone: 'green' },
        {
          key: 'duesIdentity',
          label: '학생회비 대조용 식별 문항',
          met: '',
          tone: 'red',
          detail: '학생회비 대조를 켜면 식별 문항이 필요합니다',
          locationNote: '입력 위치: 설문 문항',
          actionLabel: '문항에서 추가 →',
          targetKind: 'surveySettings',
        },
      ],
    },
  ],
}

// 설문 문항. **응답이 있는 문항은 잠긴다**(locked) — 이름·학번이 그 자리다.
const EVENT_SURVEY_QUESTIONS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'SQ-01',
      title: '이름',
      typeLabel: '단답형',
      badges: [{ label: '필수 · 삭제 불가', tone: 'gray' }],
      locked: 'y',
    },
    {
      id: 'SQ-02',
      title: '학번',
      typeLabel: '단답형',
      badges: [{ label: '필수 · 삭제 불가', tone: 'gray' }],
      locked: 'y',
    },
    { id: 'SQ-03', title: '단과대학', typeLabel: '단답형', badges: [{ label: '필수', tone: 'blue' }] },
    { id: 'SQ-04', title: '학부·학과', typeLabel: '단답형', badges: [{ label: '필수', tone: 'blue' }] },
    { id: 'SQ-05', title: '학년', typeLabel: '객관식', badges: [{ label: '필수', tone: 'blue' }] },
    {
      id: 'SQ-06',
      title: '개인정보 동의',
      typeLabel: '개인정보 동의',
      badges: [{ label: '필수', tone: 'blue' }],
    },
  ],
}

// 갈아 끼우면 무엇이 어떻게 되는지(EVT-05B). 응답자 수는 신청자 수와 같은 사실이라
// event.recruitSettings의 '142명'에서 왔다 — 두 벌을 손으로 쓰면 어긋난다.
const EVENT_SURVEY_REPLACE_IMPACT: Record<string, DataRow> = {
  'E-01': {
    title: '새 설문으로 교체하시겠어요?',
    warning: '응답이 존재하는 설문은 직접 수정할 수 없습니다.',
    currentRespondents: '142명',
    affectedRespondents: '142명 (재응답 필요)',
    notes: [
      { text: "기존 설문은 '교체됨' 상태로 변경됩니다." },
      { text: '기존 응답자 데이터는 삭제되지 않고 보관됩니다.' },
      { text: '기존 응답자는 새 설문에 다시 응답해야 합니다.' },
      { text: '기존 링크에서는 새 설문으로 이동 버튼이 표시됩니다.' },
    ],
  },
}

// ─── 링크로 온 설문 응답자가 보는 것(EXT-02A · 02B · 02C) ───────────────────
//
// **주소가 실어 오는 것은 행사가 아니라 설문의 토큰이다.** 설문은 교체될 수 있고
// 링크가 가리키는 것은 설문이므로 한 행사에 토큰이 여럿 있다 — 교체되기 전의 것과
// 지금 신청을 받는 것.
//
// 토큰을 여럿 두는 까닭은 '상태마다 다르다'가 말뿐이 되지 않게 하기 위해서다.
// 하나만 두면 화면이 늘 같은 카드를 그리고, 그래도 아무도 모른다.
//
// **바깥에서 보는 값이라 안쪽 출처를 쓰지 않는다.** 그래도 같은 사실이므로 행사의
// 기본정보에서 끌어온다 — 두 벌을 손으로 쓰면 어긋난다.
const SURVEY_APPLY_FORM: Record<string, DataRow> = {
  'SVY-4f2a91c7': {
    title: String(EVENT_OVERVIEW['E-01'].basics.title),
    // 일시만 다르다: 이 화면은 '2026-08-20 10:00'으로, 행사 개요는
    // '08. 20. (목) 10:00'으로 그렸다. EVT-05에도 있는 같은 어긋남이라 그림대로 둔다.
    startAt: '2026-08-20 10:00',
    place: String(EVENT_OVERVIEW['E-01'].basics.place),
    audience: String(EVENT_OVERVIEW['E-01'].basics.audience),
    fee: String(EVENT_OVERVIEW['E-01'].basics.fee),
  },
  // 같은 학생회의 다른 행사. 참가비를 받지 않아도 그 자리는 늘 문장으로 온다.
  'SVY-9c05b71d': {
    title: '2026 소프트웨어융합대학 학술제',
    startAt: '2026-11-05 13:00',
    place: '제3공학관 대강당',
    audience: '소프트웨어융합대학 재학생',
    fee: '무료',
  },
}

// 신청을 마친 사람이 보는 결과(EXT-02B). 신청 폼이 보내고 그대로 넘기는 토큰이다.
const SURVEY_APPLY_RESULT: Record<string, DataRow> = {
  'RCPT-SVY-4f2a91c7': {
    title: '참여 신청이 완료되었습니다',
    eventTitle: '2026 소프트웨어융합대학 체육대회',
    applicantNote: '신청자: 김바다',
    feeStatus: '관리자 확인 중',
    feeNote: '학생회비 납부 여부 확인 후 결정됩니다.',
    notices: [
      { text: '· 신청 내용은 마감 전까지 운영진에게 문의하면 수정 가능합니다.' },
      { text: '· 문의: @sw_student_council (인스타그램)' },
    ],
  },
}

// 링크가 막힌 까닭(EXT-02C). **다섯이 서로 배타적이라 토큰 하나에 하나만 온다.**
// 지금 신청을 받는 SVY-4f2a91c7은 여기 없다 — 막히지 않은 링크는 서버가 신청 폼으로
// 보내므로 이 출처가 답할 것이 없다.
const SURVEY_LINK_STATE: Record<string, DataRow> = {
  'SVY-9c15ae40': { label: '모집 전', tone: 'gray', note: '참가 신청이 아직 시작되지 않았습니다.' },
  'SVY-2e6b81f3': { label: '모집 마감', tone: 'gray', note: '참가 신청이 종료되었습니다.' },
  'SVY-77d4c0a9': { label: '정원 마감', tone: 'orange', note: '신청 정원이 모두 찼습니다.' },
  'SVY-1a58e3b6': {
    label: '링크 비활성화',
    tone: 'red',
    note: '이 링크는 더 이상 사용할 수 없습니다.',
  },
  // 응답이 있어 교체된 옛 설문(EVT-05B가 만든 상태). 다섯 중 유일하게 갈 곳이 있고,
  // 옛 토큰과 새 토큰을 잇는 것은 서버뿐이다.
  'SVY-0b3d77e1': {
    label: '기존 설문 종료 · 새 설문으로 교체됨',
    tone: 'yellow',
    note: '이 참여 조사는 종료되었습니다. 새로 진행 중인 참여 조사에 다시 응답해 주세요.',
    actionLabel: '새 설문으로 이동 →',
    replacementToken: 'SVY-4f2a91c7',
  },
}

// ─── 행사를 끝내고 완료하는 자리(EVT-02C · EVT-02E) ─────────────────────────
//
// 둘 다 **역할 이름을 화면이 들지 않는 자리**다. 누가 종료할 수 있고 누가 완료
// 처리할 수 있는지는 조직의 규칙이라 서버가 완성한 글로 온다 — 명세가 적으면
// 규칙이 바뀔 때마다 명세가 틀린다(event.wrapUpBanner.permissionNote와 같다).

// 종료를 누른 사람에게 권한이 없을 때(EVT-02C). 와이어프레임이 배경으로 그린 것이
// 기획 중 개요이므로 그 행사(E-01)에 붙인다.
const EVENT_END_PERMISSION: Record<string, DataRow> = {
  'E-01': {
    title: '이 행사를 종료할 권한이 없습니다',
    note: '행사 종료는 행사 운영 조직 관리자 또는 회장단만 할 수 있습니다.',
  },
}

// 완료 처리해도 되는지 살펴 준 것(EVT-02E). **막지 않는다** — 남은 것이 있어도
// 알려 줄 뿐이다.
//
// 남은 업무 수를 여기 다시 적지 않는다. 후속 정리 현황의 타일과 같은 것이므로
// 그 값에서 만든다 — 두 벌을 손으로 쓰면 한쪽만 고쳐지고, 그 어긋남이 재정 보드와
// 요청 상세에서 이미 한 번 났다.
const EVENT_COMPLETE_CONFIRM: Record<string, DataRow> = {
  [WRAP_UP_EVENT]: {
    warningNote: `미완료 업무 ${String(EVENT_WRAP_UP_COUNTS[WRAP_UP_EVENT].unfinishedTasks)}`,
    // 타일은 red인데 이 상자는 orange다. 같은 사실이라도 그려지는 자리가 다르면
    // 색이 다르고, 그래서 색 이름을 데이터가 갖는다(design 20:6339).
    warningTone: 'orange',
    permissionNote: EVENT_WRAP_UP_BANNER[WRAP_UP_EVENT].permissionNote,
  },
}

// ─── 행사 운영 조직(EVT-03A) ───────────────────────────────────────────────
//
// 디자인이 그린 그대로다 - 책임자 하나, 부서 셋이고 **홍보팀만 부서장이 없다.**
// 그 없음이 부서장을 지정하라는 자리를 부른다.
//
// 학생회의 조직도(org.executives·org.departments)와 모양이 같고 물건이 다르다 -
// 저기는 학생회가 늘 갖는 조직이고 여기는 이 행사에만 있는 조직이라 행사마다 따로 온다.
const EVENT_STAFF_LEADERS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'ES-01',
      name: '김바다',
      major: '컴퓨터학부',
      grade: '3학년',
      roleLabel: '책임자',
      roleTone: 'yellow',
    },
  ],
}

const EVENT_STAFF_DEPARTMENTS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'ED-01',
      name: '운영팀',
      memberCountLabel: '부원 2명',
      leaders: [{ id: 'ES-02', name: '이윤슬', major: '컴퓨터학부', grade: '3학년' }],
      members: [
        { id: 'ES-03', name: '김바다', major: '컴퓨터학부', grade: '3학년' },
        { id: 'ES-04', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
      ],
    },
    {
      id: 'ED-02',
      name: '홍보팀',
      memberCountLabel: '부원 1명',
      leaders: [],
      members: [{ id: 'ES-05', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' }],
    },
    {
      id: 'ED-03',
      name: '현장팀',
      memberCountLabel: '부원 1명',
      leaders: [{ id: 'ES-06', name: '정하늘', major: '컴퓨터학부', grade: '3학년' }],
      members: [
        // 이 사람만 부서장을 겸한다. 그 사실은 leaders로는 알 수 없다 —
        // 부원 줄에 무엇이 그려지는지는 그 줄의 조각이 말해야 한다.
        {
          id: 'ES-07',
          name: '정하늘',
          major: '컴퓨터학부',
          grade: '3학년',
          roleLabel: '· 부서장',
          roleTone: 'yellow',
        },
      ],
    },
  ],
  // E-03은 자리를 만들지 않는다. 아직 조직을 구성하지 않은 행사이고, 그 상태를
  // 그린 것이 EVT-03C다 - 목록이 비는 것이지 행사가 없는 것이 아니다.
}

// 운영 조직을 세울 때의 미리보기(EVT-01). event.staffDepartments가 **이미 있는**
// 조직을 말하는 반면 이것은 고른 방식으로 **만들어질** 조직이라 조회 인자에
// 방식이 함께 든다(setupMode).
//
// 행사가 아니라 방식이 정한다 - '기본 조직 불러오기'는 학생회의 기본 조직을
// 그대로 가져오는 것이므로 어느 행사에서 열든 같은 것이 온다.
const EVENT_STAFF_SETUP_PREVIEW: Record<string, DataRow[]> = {
  // 두 벌로 적으면 한쪽만 고쳐진다. 만들어질 것이 곧 기본 조직이다.
  copyBase: EVENT_STAFF_DEPARTMENTS['E-01'],
  // 부서만 가져오고 사람은 만든 뒤에 배정한다.
  pickDepartments: EVENT_STAFF_DEPARTMENTS['E-01'].map((row) => ({
    ...row,
    memberCountLabel: '부원 0명',
    leaders: [],
    members: [],
  })),
  empty: [],
}

// EVT-03B의 오른쪽 기둥. **카탈로그는 '미배정'이라 부르는데 디자인은 '기본 조직
// 구성원'이라 적고 부서에 이미 든 사람을 그대로 그렸다**(20:7302). 그래서 부서의
// 부원과 같은 id를 쓴다 - 다른 id를 주면 한 사람이 두 사람이 되고, 자리에서 뺀
// 사람이 명단에 두 번 나온다.
const EVENT_STAFF_UNASSIGNED: Record<string, DataRow[]> = {
  'E-01': [
    { id: 'ES-03', name: '김바다', major: '컴퓨터학부', grade: '3학년' },
    { id: 'ES-04', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
    { id: 'ES-05', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' },
    { id: 'ES-07', name: '정하늘', major: '컴퓨터학부', grade: '3학년' },
  ],
}

// 조직이 아직 없는 행사. **E-02를 쓸 수 없다** - 그쪽은 끝나고 정리 중인 행사라
// 조직이 없을 수 없다. 값은 행사 목록(EVT-00A)이 그린 '2026 신입생 환영 행사'의
// 줄에서 옮겼다. 그 줄이 '기본 정보 입력 필요 / 일시 미정 / 담당 미정'이다.
const UNSTAFFED_EVENT = 'E-03'

// 작업 공간의 머리가 이 둘을 한 건씩 집어 오므로, 없으면 빈 상태를 열기도 전에
// readObjectSource가 던진다.
EVENT_WORKSPACES[UNSTAFFED_EVENT] = {
  status: '기획 중',
  statusKey: 'planning',
  statusTone: 'blue',
  host: '담당 미정',
  startAt: '일시 미정',
  nextSchedule: '다음 일정 · 미정',
  permissionNote: '행사 관리 행동은 담당 운영진에게 제공됩니다.',
}

EVENT_SUMMARIES[UNSTAFFED_EVENT] = {
  title: '2026 신입생 환영 행사',
  schedule: '일시 미정 · 장소 미정',
  dday: '일정 미정',
  progressPercent: 0,
  progressLabel: '0 / 0 완료',
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

// 역할 및 권한(ORG-04). 디자인이 그린 열세 줄 그대로다. 칸에 오는 것은 '되는가'가
// 아니라 '어떤 조건에서 되는가'이므로 완성된 말과 색 이름이 함께 온다.
const PERMISSION_MATRIX: DataRow[] = [
  ['재정 현황·사용 내역 열람', '가능', '가능', '가능'],
  ['예산 수정·구매 승인·증빙 처리', '가능', '재정부만', '재정부만'],
  ['회의 생성', '가능', '가능', '—'],
  ['행사 만들기', '가능', '가능', '—'],
  ['행사 정보 수정·종료 처리', '가능', '행사 조직만', '행사 조직만'],
  ['행사 완료 처리', '가능', '—', '—'],
  ['행사 운영 조직 구성·수정', '가능', '행사 조직 관리자만', '행사 조직 관리자만'],
  ['조직 구조 수정', '가능', '—', '—'],
  ['구성원 초대', '가능', '자기 부서만', '—'],
  ['학생 명단 열람', '가능', '가능', '가능'],
  ['학생 명단 업로드·갱신', '가능', '—', '—'],
  ['학생회비 납부 명단 업로드', '가능', '재정부만', '재정부만'],
  ['학생 명단 내보내기', '가능', '—', '—'],
].map(([area, chair, head, member]) => ({
  id: area,
  area,
  chair,
  // '가능'은 초록, 조건이 붙으면 노랑, 못 하면 무채색이다. 색 이름을 데이터가
  // 주는 이유는 조건이 하나 늘 때 화면이 짐작하지 않게 하기 위해서다.
  chairTone: permissionTone(chair),
  head,
  headTone: permissionTone(head),
  member,
  memberTone: permissionTone(member),
}))

function permissionTone(label: string): string {
  if (label === '가능') return 'green'
  if (label === '—') return 'gray'
  return 'yellow'
}

// ── 조직 전체 재정(FIN-00 · FIN-00B · FIN-LEDGER-01) ────────────────────────
//
// **행사 하나의 재정과 다른 물건이다.** event.financeSummary는 eventId를 받아 그
// 행사만 세고, 이쪽은 학생회 전체를 센다.

const ORG_FINANCE_OVERVIEW: DataRow = {
  termNote: '2026년 1학기',
  asOfNote: '2026.07.18 기준',
  totalBudget: '30,000,000원',
  totalBudgetNote: '학생회비 외 1건',
  spent: '12,400,000원',
  spentNote: '결제가 완료된 9건',
  planned: '3,100,000원',
  plannedNote: '결제 예정 3건',
  available: '14,500,000원',
  availableNote: '새로 사용할 수 있는 금액',
  executionNote: '전체 예산 집행률 41.3%',
  plannedIncludedNote: '지출 예정 포함 51.7%',
  // 막대의 두 마디. 이어 붙는 몫이라 41.3 + 10.4 = 51.7이다.
  spentPercent: 41.3,
  plannedPercent: 10.4,
}

// 나누는 축이 줄의 뜻을 통째로 바꾼다. 행사별은 디자인이 그린 그대로이고,
// 부서별은 그려지지 않았으므로 조직도의 부서로 서버 대역을 만든다.
const ORG_BREAKDOWN: Record<string, DataRow[]> = {
  event: [
    { id: 'E-01', name: '체육대회', budget: '5,000,000원', spent: '2,100,000원', planned: '600,000원', available: '2,300,000원', executionPercent: 54 },
    { id: 'E-02', name: '신입생 환영 행사', budget: '3,000,000원', spent: '1,800,000원', planned: '200,000원', available: '1,000,000원', executionPercent: 67 },
    { id: 'E-03', name: '가을 축제', budget: '8,000,000원', spent: '0원', planned: '0원', available: '8,000,000원', executionPercent: 0 },
  ],
  department: [
    { id: 'D-01', name: '기획부', budget: '4,000,000원', spent: '1,500,000원', planned: '300,000원', available: '2,200,000원', executionPercent: 38 },
    { id: 'D-02', name: '홍보부', budget: '3,500,000원', spent: '2,100,000원', planned: '400,000원', available: '1,000,000원', executionPercent: 60 },
    { id: 'D-04', name: '운영부', budget: '2,000,000원', spent: '600,000원', planned: '0원', available: '1,400,000원', executionPercent: 30 },
  ],
}

const ORG_PROOF_SUMMARY: DataRow = {
  completed: '6건',
  supplement: '1건',
  unregistered: '2건',
  totalNote: '26건',
}

// 장부 한 벌. FIN-00의 '최근 지출 내역'과 FIN-LEDGER-01의 '사용 내역'이 **같은
// 장부**를 다르게 자른 것이다 — 두 벌로 적으면 같은 지출에 다른 이름이 붙는다
// (재정 보드가 PR-01과 PR-2026-0031로 갈렸던 그 자리다).
//
// **와이어프레임이 두 화면에 서로 다른 줄을 그렸다.** 같은 07.17을 FIN-00은
// '현수막 제작 180,000원'으로, LEDGER-01은 '케이블 커버 6m 외 1건 84,000원'으로
// 그린다. 대조기는 그린 글을 그대로 요구하므로 둘 다 이 한 벌에 담고, 어느 줄이
// 어느 그림의 것인지만 drawnOn에 적는다.
const ORG_LEDGER: Array<{
  month: string
  drawnOn: 'FIN-00' | 'FIN-LEDGER-01'
  eventId: string
  departmentId: string
  budgetItemId: string
  row: DataRow
}> = [
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-01', row: { id: 'LG-01', date: '07.17', title: '케이블 커버 6m 외 1건', context: '2026 체육대회', department: '운영부', budgetItem: '안전·설비', amountNote: '84,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-02', row: { id: 'LG-02', date: '07.16', title: '안전 안내 표지 제작', context: '2026 체육대회', department: '운영부', budgetItem: '인쇄·제작', amountNote: '45,000원', proof: '누락', proofTone: 'red' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-02', budgetItemId: 'BI-02', row: { id: 'LG-03', date: '07.15', title: '현수막 제작 (본부석)', context: '2026 체육대회', department: '홍보부', budgetItem: '인쇄·제작', amountNote: '120,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-03', row: { id: 'LG-04', date: '07.14', title: '진행요원 교육 다과', context: '2026 체육대회', department: '운영부', budgetItem: '회의·운영비', amountNote: '32,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-02', departmentId: 'D-01', budgetItemId: 'BI-04', row: { id: 'LG-05', date: '07.11', title: '웰컴 키트 견본 구매', context: '신입생 환영 행사', department: '기획부', budgetItem: '물품 구매', amountNote: '58,000원', proof: '확인 중', proofTone: 'yellow' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-01', row: { id: 'LG-06', date: '07.10', title: '구급약품 세트', context: '2026 체육대회', department: '운영부', budgetItem: '안전·설비', amountNote: '67,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-04', budgetItemId: 'BI-03', row: { id: 'LG-07', date: '07.08', title: '정기 운영회의 간식', context: '운영 (상시)', department: '운영부', budgetItem: '회의·운영비', amountNote: '21,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-02', departmentId: 'D-02', budgetItemId: 'BI-05', row: { id: 'LG-08', date: '07.05', title: 'SNS 광고 집행', context: '신입생 환영 행사', department: '홍보부', budgetItem: '홍보비', amountNote: '90,000원', proof: '누락', proofTone: 'red' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-04', budgetItemId: 'BI-06', row: { id: 'LG-09', date: '07.03', title: '사무용품 (A4·토너)', context: '운영 (상시)', department: '운영부', budgetItem: '사무·비품', amountNote: '43,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-05', budgetItemId: 'BI-06', row: { id: 'LG-10', date: '07.01', title: '회계 장부 바인더', context: '운영 (상시)', department: '재정부', budgetItem: '사무·비품', amountNote: '15,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-00', eventId: 'E-01', departmentId: 'D-02', budgetItemId: 'BI-02', row: { id: 'LG-11', date: '07.17', title: '현수막 제작', context: '체육대회', department: '홍보부', budgetItem: '인쇄·제작', amountNote: '180,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-00', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-04', row: { id: 'LG-12', date: '07.16', title: '생수 구매', context: '체육대회', department: '운영부', budgetItem: '물품 구매', amountNote: '120,000원', proof: '확인 중', proofTone: 'yellow' } },
  { month: '2026-07', drawnOn: 'FIN-00', eventId: 'E-02', departmentId: 'D-01', budgetItemId: 'BI-02', row: { id: 'LG-13', date: '07.15', title: '명찰 인쇄', context: '신입생 환영 행사', department: '기획부', budgetItem: '인쇄·제작', amountNote: '75,000원', proof: '누락', proofTone: 'red' } },
  // 달을 바꾸면 정말 다른 것이 오는지 보려고 둔 개발용 줄이다(그려지지 않았다).
  { month: '2026-06', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-01', budgetItemId: 'BI-03', row: { id: 'LG-14', date: '06.28', title: '신입생 간담회 다과', context: '운영 (상시)', department: '기획부', budgetItem: '회의·운영비', amountNote: '38,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-06', drawnOn: 'FIN-LEDGER-01', eventId: 'E-02', departmentId: 'D-02', budgetItemId: 'BI-02', row: { id: 'LG-15', date: '06.20', title: '홍보 포스터 인쇄', context: '신입생 환영 행사', department: '홍보부', budgetItem: '인쇄·제작', amountNote: '52,000원', proof: '완료', proofTone: 'green' } },
]

// 고르지 않았으면 이번 달이다 — 그 판단은 서버가 한다(명세가 '이번 달'을 말할
// 어휘가 없다. 백로그에 적었다).
const DEFAULT_LEDGER_MONTH = '2026-07'

const LEDGER_MONTHS: Record<string, { label: string; total: number }> = {
  '2026-07': { label: '2026년 7월', total: 42 },
  '2026-06': { label: '2026년 6월', total: 31 },
}

const LEDGER_SUMMARY: Record<string, DataRow> = {
  '2026-07': { termTotal: '3,842,000원', monthLabel: '7월 지출', monthTotal: '1,286,000원', proofDone: '42건 중 37건', proofMissing: '5건' },
  '2026-06': { termTotal: '3,842,000원', monthLabel: '6월 지출', monthTotal: '968,000원', proofDone: '31건 중 31건', proofMissing: '0건' },
}

// **역할 이름이 여기 있다.** 명세도 화면도 이 문장을 들지 않는다.
const LEDGER_HANDLING_NOTE =
  '증빙 처리와 정산은 재정부·회장단이 각 행사 재정의 ‘증빙 필요’ 단계(결제·증빙 정리)에서 진행합니다.'

// 결제가 끝난 것과 아직 나갈 것. **증빙 상태로는 가를 수 없다** — 증빙은 돈이
// 나간 뒤의 절차이고 이것은 돈이 나갔는지의 물음이다.
const LEDGER_STAGE: Record<string, string> = {
  'LG-05': 'planned',
  'LG-08': 'planned',
  'LG-14': 'planned',
}
const stageOf = (id: unknown) => LEDGER_STAGE[String(id)] ?? 'spent'

function ledgerEntriesOf({
  month = '',
  eventId = '',
  departmentId = '',
  budgetItemId = '',
  query = '',
  stage = '',
}: Record<string, string>) {
  return ORG_LEDGER.filter(
    (entry) =>
      entry.drawnOn === 'FIN-LEDGER-01' &&
      entry.month === (month || DEFAULT_LEDGER_MONTH) &&
      (eventId === '' || entry.eventId === eventId) &&
      (departmentId === '' || entry.departmentId === departmentId) &&
      (budgetItemId === '' || entry.budgetItemId === budgetItemId) &&
      (stage === '' || stageOf(entry.row.id) === stage) &&
      matchesQuery(entry.row, query),
  )
}

// 무엇을 보고 있는지는 **서버가 완성한 문장**이 말한다. 그림에 갈피가 없으므로
// 이 줄이 유일한 단서다 — 화면이 지어내면 그 말이 화면의 것이 된다.
const LEDGER_STAGE_NOTE: Record<string, string> = {
  spent: '결제 완료',
  planned: '결제 예정',
}

// ── 운영 캘린더(OPS-CAL-01) ────────────────────────────────────────────────
//
// 값은 figma.design.json이 그린 2026년 7월을 그대로 옮긴 것이다. **어느 달인지는
// 서버가 정한다** — 명세가 달을 옮기는 조작을 담을 어휘가 없어 화면이 넘길 값이
// 없다(finance.ledgerSummary의 DEFAULT_LEDGER_MONTH와 같은 처지다).
//
// 유형은 조각으로 내보내지 않고 여기서만 쓴다 — 서버가 걸러서 주는 값이므로
// 화면이 볼 일이 없다. 딱지 색은 그 유형의 이름이 곧 톤 이름이다.
const CALENDAR_DAYS: Array<{
  id: string
  dayLabel: string
  dayTone: string
  schedules: Array<{ id: string; title: string; type: string }>
}> = [
  { id: '2026-06-28', dayLabel: '', dayTone: 'gray', schedules: [] },
  { id: '2026-06-29', dayLabel: '', dayTone: 'gray', schedules: [] },
  { id: '2026-06-30', dayLabel: '', dayTone: 'gray', schedules: [] },
  { id: '2026-07-01', dayLabel: '1', dayTone: 'gray', schedules: [] },
  { id: '2026-07-02', dayLabel: '2', dayTone: 'gray', schedules: [] },
  { id: '2026-07-03', dayLabel: '3', dayTone: 'gray', schedules: [] },
  { id: '2026-07-04', dayLabel: '4', dayTone: 'blue', schedules: [] },
  { id: '2026-07-05', dayLabel: '5', dayTone: 'red', schedules: [] },
  { id: '2026-07-06', dayLabel: '6', dayTone: 'gray', schedules: [] },
  { id: '2026-07-07', dayLabel: '7', dayTone: 'gray', schedules: [] },
  { id: '2026-07-08', dayLabel: '8', dayTone: 'gray', schedules: [] },
  { id: '2026-07-09', dayLabel: '9', dayTone: 'gray', schedules: [] },
  { id: '2026-07-10', dayLabel: '10', dayTone: 'gray', schedules: [] },
  { id: '2026-07-11', dayLabel: '11', dayTone: 'blue', schedules: [] },
  { id: '2026-07-12', dayLabel: '12', dayTone: 'red', schedules: [] },
  { id: '2026-07-13', dayLabel: '13', dayTone: 'gray', schedules: [] },
  { id: '2026-07-14', dayLabel: '14', dayTone: 'gray', schedules: [] },
  { id: '2026-07-15', dayLabel: '15', dayTone: 'gray', schedules: [] },
  { id: '2026-07-16', dayLabel: '16', dayTone: 'gray', schedules: [] },
  { id: '2026-07-17', dayLabel: '17', dayTone: 'gray', schedules: [] },
  { id: '2026-07-18', dayLabel: '18', dayTone: 'blue', schedules: [{ id: 'SCH-0718-1', title: '현수막 디자인 수정 반영', type: 'deadline' }, { id: 'SCH-0718-2', title: '학생 건의함 확인·답변', type: 'deadline' }] },
  { id: '2026-07-19', dayLabel: '19', dayTone: 'today', schedules: [] },
  { id: '2026-07-20', dayLabel: '20', dayTone: 'gray', schedules: [{ id: 'SCH-0720-1', title: '체육대회 참가 신청 마감', type: 'deadline' }, { id: 'SCH-0720-2', title: '참가자 모집 공지 작성', type: 'deadline' }] },
  { id: '2026-07-21', dayLabel: '21', dayTone: 'gray', schedules: [{ id: 'SCH-0721-1', title: '주간 운영회의 자료 준비', type: 'deadline' }] },
  { id: '2026-07-22', dayLabel: '22', dayTone: 'gray', schedules: [{ id: 'SCH-0722-1', title: '정기 운영회의', type: 'meeting' }, { id: 'SCH-0722-2', title: '행사 안전 안내문 검토', type: 'deadline' }, { id: 'SCH-0722-3', title: '회계 장부 주간 정리', type: 'deadline' }, { id: 'SCH-0722-4', title: '학생 건의 답변 문안 검토', type: 'deadline' }] },
  { id: '2026-07-23', dayLabel: '23', dayTone: 'gray', schedules: [{ id: 'SCH-0723-1', title: '비상 연락망 최종본 배포', type: 'deadline' }] },
  { id: '2026-07-24', dayLabel: '24', dayTone: 'gray', schedules: [] },
  { id: '2026-07-25', dayLabel: '25', dayTone: 'blue', schedules: [{ id: 'SCH-0725-1', title: '물품 구매 요청', type: 'deadline' }] },
  { id: '2026-07-26', dayLabel: '26', dayTone: 'red', schedules: [] },
  { id: '2026-07-27', dayLabel: '27', dayTone: 'gray', schedules: [] },
  { id: '2026-07-28', dayLabel: '28', dayTone: 'gray', schedules: [{ id: 'SCH-0728-1', title: '신입생 환영 기획회의 2차', type: 'meeting' }] },
  { id: '2026-07-29', dayLabel: '29', dayTone: 'gray', schedules: [] },
  { id: '2026-07-30', dayLabel: '30', dayTone: 'gray', schedules: [] },
  { id: '2026-07-31', dayLabel: '31', dayTone: 'gray', schedules: [{ id: 'SCH-0731-1', title: '행사장 사전 답사', type: 'event' }, { id: 'SCH-0731-2', title: '게시판 공지물 정리', type: 'deadline' }] },
]

// 이번 주(07.19~07.25) 줄. 격자와 **같은 일정**을 세로로 세운 것이라 제목이 겹친다.
// 행사에 딸린 줄만 '행사 일정 보기'를 갖는다 — 상시 업무의 마감과 운영 회의는
// 열 행사가 없다. 이 있고 없음이 표현이 아니라 뜻이다.
const CALENDAR_WEEK: Array<{ type: string; row: DataRow }> = [
  { type: 'deadline', row: { id: 'SCH-0720-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.20', title: '체육대회 참가 신청 마감', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'meeting', row: { id: 'SCH-0722-1', typeLabel: '회의', typeTone: 'meeting', dateLabel: '07.22', title: '정기 운영회의' } },
  { type: 'deadline', row: { id: 'SCH-0723-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.23', title: '비상 연락망 최종본 배포' } },
  { type: 'deadline', row: { id: 'SCH-0720-2', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.20', title: '참가자 모집 공지 작성', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'deadline', row: { id: 'SCH-0725-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.25', title: '물품 구매 요청', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'deadline', row: { id: 'SCH-0722-2', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.22', title: '행사 안전 안내문 검토', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'deadline', row: { id: 'SCH-0721-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.21', title: '주간 운영회의 자료 준비' } },
  { type: 'deadline', row: { id: 'SCH-0722-3', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.22', title: '회계 장부 주간 정리' } },
  { type: 'deadline', row: { id: 'SCH-0722-4', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.22', title: '학생 건의 답변 문안 검토' } },
]

// 초대 코드가 찾아낸 학생회(INV-01). **코드마다 다른 학생회가 나온다** — 그 전에는
// 명세가 이름을 고정 글로 들고 있어서 어떤 코드를 넣어도 같은 학생회가 나왔다.
const INVITED_ORGANIZATIONS: Record<string, DataRow> = {
  AB12CD34: {
    name: '제12대 소프트웨어융합대학 학생회',
    kind: '단과대 학생회',
    scope: '한양대학교 ERICA · 소프트웨어융합대학',
    term: '2026년',
  },
  // 코드가 다르면 다른 학생회다. 이 줄이 없으면 '코드마다 다르다'가 말뿐이 된다.
  EF56GH78: {
    name: '제9대 컴퓨터학부 학생회',
    kind: '학부 학생회',
    scope: '한양대학교 ERICA · 컴퓨터학부',
    term: '2026년',
  },
}

export const DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 행사 목록을 보는 사람. 지금 보는 사람은 새 행사를 만들 수 없다 - 만들 수 있는
  // 사람이 보는 그림이 EVT-00A2(변형)이고, 사람이 그 사이를 오갈 수 없다.
  'event.listViewer': { canCreateEvent: false },
  // 전체 재정 현황을 보는 사람. 지금 보는 사람은 예산을 편성할 수 없다 - 편성할
  // 수 있는 사람이 보는 그림이 FIN-00B(변형)이고, 사람이 그 사이를 오갈 수 없다.
  'finance.overviewViewer': { canPlanBudget: false },
  // 캘린더가 지금 보여주는 달과 이번 주. 둘 다 오늘이 정하므로 서버의 것이다.
//   'record.completedEventAlert': COMPLETED_EVENT_ALERT,
  'record.completedEventAlert': COMPLETED_EVENT_ALERT,
  'ops.calendarMonth': { monthLabel: '2026년 7월' },
  'ops.calendarWeekRange': { rangeNote: '07.19 (일) – 07.25 (토) · 오늘 07.19' },
  // 회의 목록의 띠. 지금 보는 사람은 일반 참가자다 - 와이어프레임의 다른 셋
  // (진행 권한자·회의 생성 가능·미참가자)은 같은 화면을 다른 사람이 볼 때다.
  'meeting.attention': {
    viewerTitle: '일반 참가자 화면',
    viewerNote: '초대된 회의의 일정과 참가 상태를 확인합니다.',
    attentionNote: '확인 필요한 회의 2건',
    canCreateMeeting: false,
  },
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
  'org.roleCounts': { chairCount: 1, headCount: 3, memberCount: 3 },
  'org.roleAssignmentCount': { total: '7명' },
  'org.rosterScope': {
    path: '한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부',
    note: '컴퓨터학부 학생만 이 명단에 등록할 수 있습니다. 범위 변경은 조직 설정에서 가능합니다.',
    rosterUpdatedAt: '2026-07-20 14:32',
    rosterUpdatedBy: '학생 명단 업로드 · 이지원',
    duesUpdatedAt: '2026-07-18 10:15',
    duesUpdatedBy: '2026년 1학기 · 김민준',
  },
  // 고른 사람. 어느 구성원을 고를지가 아직 주소로 오가지 않아 서버가 준다.
  'org.selectedRoleAssignment': {
    id: 'M-03',
    name: '박해랑',
    department: '운영부',
    roleLabel: '부원',
    roleTone: 'gray',
    role: 'member',
  },
  'org.roleAssignments': [
    { id: 'M-01', name: '김바다', department: '학술체육부', roleLabel: '회장단', roleTone: 'violet', role: 'chair' },
    { id: 'M-11', name: '이수현', department: '기획부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
    { id: 'M-02', name: '이윤슬', department: '홍보부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
    { id: 'M-12', name: '김민준', department: '재정부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
    { id: 'M-03', name: '박해랑', department: '운영부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
    { id: 'M-07', name: '정하늘', department: '운영부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
    { id: 'M-13', name: '박민수', department: '기획부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
  ],
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
  // 메시지 방 목록(MSG-01). **비어 있는 것이 이 저장소가 아는 전부다** —
  // 와이어프레임이 그린 것은 방이 하나도 없는 모습뿐이고, 줄에 무엇이 그려지는지는
  // 어느 프레임에도 없다. 여기에 방을 하나 넣으면 그 줄의 모양을 개발용 응답이
  // 지어내게 되고, 그것은 서버 대역이 아니라 디자인을 만드는 일이다.
  'message.rooms': [],
  // 대화(MSG-03). 같은 이유로 비었다. 빈 상태의 글이 '주고받은 말이 없다'가 아니라
  // **'들어갈 방이 없다'**고 말하므로, message.rooms가 빈 동안 이쪽도 비는 것이 앞뒤가 맞는다.
  'message.conversation': [],
  'org.permissionMatrix': PERMISSION_MATRIX,
  'my.taskTabCounts': countByTab(),
  'finance.orgOverview': ORG_FINANCE_OVERVIEW,
  'finance.proofSummary': ORG_PROOF_SUMMARY,
  'finance.recentExpenses': ORG_LEDGER.filter((entry) => entry.drawnOn === 'FIN-00').map(
    (entry) => entry.row,
  ),
  'task.alerts': taskAlerts(),
}

// 인자를 받는 출처. 실제로는 서버가 걸러 주므로 mock도 여기서 거른다 —
// 받아온 것을 화면에서 거르면 명세(itemList.params)와 다른 것을 구현하게 된다.
//
// MY-01 디자인이 그린 것은 '해야 할 업무' 탭 2건뿐이다. 다른 탭의 행은
// 탭이 실제로 무언가를 바꾸는지 보려고 둔 개발용 값이다(HOME-01K의 일정에서
// 가져왔다). 탭 건수는 이 목록에서 세므로 목록과 배지가 어긋날 수 없다.

const ORG_DEPARTMENTS: DataRow[] = [
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
  {
    id: 'D-04',
    name: '운영부',
    memberCountLabel: '부원 1명',
    leaders: [],
    members: [{ id: 'M-10', name: '박해랑', major: '컴퓨터학부', grade: '2학년' }],
  },
  {
    id: 'D-05',
    name: '재정부',
    memberCountLabel: '부원 1명',
    leaders: [],
    members: [{ id: 'M-09', name: '김민준', major: '컴퓨터학부', grade: '4학년' }],
  },
]

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
// **아직 안 적은 수는 오지 않는다.** 빈 글('')로 주면 같은 조각이 때로 수, 때로
// 글이 되고 — 값의 종류를 도출해 보니 저장소에서 그런 조각이 이 둘뿐이었다.
// 0은 값이므로(0개·0원) 빈 것과 0을 글로 섞으면 둘을 가를 수 없다.
const EMPTY_PURCHASE_REQUEST_ITEM: DataRow = {
  itemName: '',
  itemCategory: '',
  budgetItem: '',
  purchaseType: '',
  unit: '',
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

// 학생 명단(ORG-07A). 디자인이 그린 여덟 줄 그대로다.
//
// **rowTone은 대부분 비어 있다.** 손봐야 하는 줄에만 색 이름이 오고, 그 줄은
// 명단과 납부 기록이 어긋나 사람이 확인해야 하는 학생이다.
const STUDENT_ROSTER: DataRow[] = [
  ['S-01', '김바다', '2022123456', '3학년', '납부', 'green', ''],
  ['S-02', '박해랑', '2023234567', '2학년', '납부', 'green', ''],
  ['S-03', '이윤슬', '2020345678', '4학년', '미납', 'red', ''],
  ['S-04', '정하늘', '2022456789', '3학년', '미납', 'red', ''],
  ['S-05', '최바람', '2021567890', '3학년', '확인 필요', 'yellow', 'yellow'],
  ['S-06', '강별', '2024678901', '1학년', '납부', 'green', ''],
  ['S-07', '오하늘', '2023789012', '2학년', '납부', 'green', ''],
  ['S-08', '윤서진', '2022890123', '3학년', '미납', 'red', ''],
].map(([id, name, studentNumber, grade, duesLabel, duesTone, rowTone]) => ({
  id,
  name,
  studentNumber,
  // 관리 범위가 컴퓨터학부 하나라 여덟 줄이 다 같다. 그래도 조각으로 온다 -
  // 범위가 넓어지면 줄마다 갈린다.
  college: '소프트웨어융합대학',
  department: '컴퓨터학부',
  grade,
  duesLabel,
  duesTone,
  rowTone,
}))

const DUES_BY_STATUS: Record<string, string> = {
  paid: '납부',
  unpaid: '미납',
  check: '확인 필요',
}

// -- 회의 한 건 --------------------------------------------------------------
//
// 와이어프레임이 상세를 그린 회의는 셋이다: 안전 관리 최종 회의(MTG-05, 03·05·07·08),
// 신입생 환영 행사 기획회의(MTG-06, 06A), 가을 축제 1차 준비회의(MTG-07, 09가 그린
// 취소된 회의). 목록의 일곱과 같은 id를 쓴다 - 줄을 누르면 그 회의로 가야 한다.
//
// **조각이 상태마다 다르다.** 예정 회의에 startedAt이 없고 취소된 회의에만
// cancelReason이 있다. 명세가 출처 하나로 두고 없는 것은 안 보내기로 한 그대로다.

const MEETING_DETAIL: Record<string, DataRow> = {
  // 09가 가리키는 대체 회의. 취소된 회의(MTG-07)를 대신해 새로 잡힌 것이라
  // 예정 상태다. 이 회의가 없으면 09의 '새로운 일정을 조율한 뒤 …가
  // 생성되었습니다'가 거짓말이 되고, 눌러도 빈 화면이 열린다.
  'MTG-08': {
    title: '가을 축제 운영 방향 회의',
    description: '취소된 1차 준비회의를 대신해 부스 배치와 예산 배분을 다시 논의합니다.',
    status: '예정',
    statusTone: 'blue',
    kindLabel: '행사 관련 회의',
    kindTone: 'gray',
    eventTitle: '2026 가을 축제',
    eventId: 'EVT-2026-FALL',
    creatorNote: '김바다 · 기획부',
    updatedNote: '2026.07.29 11:25 수정',
    materialCountNote: '등록 자료 0개',
    scheduledAt: '2026.08.12 13:00',
    plannedDurationNote: '1시간',
    place: '학생회실 (A204)',
    inviteeCountNote: '15명',
    viewerTitle: '일반 참가자 화면',
    viewerNote: '회의 정보를 확인할 수 있지만 회의를 시작하거나 설정을 변경할 수 없습니다.',
    viewerChipLabel: '예정 회의',
    viewerChipTone: 'gray',
    stateBannerTitle: '아직 회의가 시작되지 않았습니다',
    stateBannerNote:
      '회의가 시작되면 목록과 이 화면의 버튼이 ‘회의 참가’로 변경됩니다. 이 화면을 확인한 것은 참석으로 기록되지 않습니다.',
    stateBannerTone: 'blue',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: false,
    agendaCountNote: '총 2개',
    participantCountNote: '초대 15명',
  },
  // 완료된 회의(OPS-MEET-07·08). 값은 figma.design.json이 그린 예시를 그대로 옮긴
  // 것이라 구현 화면과 reference.png를 눈으로 대조할 수 있다.
  //
  // **목록(MEETING_GROUPS)의 MTG-01과 회의 이름이 다르다.** 목록은 '7월 예산
  // 검토회의'로 그려졌고 07/08의 상세는 '체육대회 안전 관리 최종 회의'를 그렸다.
  // 둘 다 각자의 와이어프레임 그대로이며, 어긋난 것은 그림이지 픽스처가 아니다.
  'MTG-01': {
    title: '체육대회 안전 관리 최종 회의',
    description:
      '행사 전 안전 점검 결과를 공유하고 비상 연락망과 현장 안전 인력 배치를 최종 확정합니다.',
    status: '완료',
    statusTone: 'gray',
    // 회의의 상태와 회의록의 상태는 다른 축이다 - 띠의 '완료'는 회의록의 것이다.
    minutesStatus: '완료',
    minutesStatusTone: 'green',
    kindLabel: '행사 관련 회의',
    kindTone: 'gray',
    eventTitle: '2026 소프트웨어융합대학 체육대회',
    eventId: 'EVT-2026-SPORTS',
    creatorNote: '박해랑 · 운영부',
    scheduledAt: '2026.07.25 15:00',
    place: '학생회실 (A204)',
    inviteeCountNote: '4명',
    viewerTitle: '참석자 화면',
    viewerNote: '정리된 회의록을 읽고 받아 갈 수 있습니다.',
    viewerChipLabel: '15:07 참석',
    viewerChipTone: 'gray',
    stateBannerTitle: '회의록 정리가 완료되었습니다',
    stateBannerNote: '2026.07.25 16:30 박해랑이 최종 정리했습니다.',
    stateBannerTone: 'green',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: false,
    // 실제 진행 시각. 예정 일시와 다르고 끝난 뒤에만 온다. 붙임표는 en dash다.
    actualTimeNote: '2026.07.25 15:00–16:12',
    attendanceResultNote: '3명 참석 · 1명 불참',
    decisionCountNote: '2건',
    followUpCountLabel: '없음',
    myFollowUpCountLabel: '0건',
    // 와이어프레임이 파일 이름을 그리지 않았다. 무엇을 어떤 형식으로 낼지는
    // 서버가 정하는 값이라 픽스처가 하나 세워 둔다.
    exportName: '체육대회_안전관리_최종회의_회의록.pdf',
  },
  'MTG-04': {
    title: '체육대회 안전 관리 최종 회의',
    description: '행사 전 안전 점검 결과를 공유하고 비상 연락망과 현장 안전 인력 배치를 최종 확정합니다.',
    status: '진행 중',
    statusTone: 'green',
    kindLabel: '행사 관련 회의',
    kindTone: 'gray',
    eventTitle: '2026 소프트웨어융합대학 체육대회',
    eventId: 'EVT-2026-SPORTS',
    creatorNote: '박해랑 · 운영부',
    scheduledAt: '2026.07.25 15:00',
    plannedDurationNote: '1시간 30분',
    place: '학생회실 (A204)',
    inviteeCountNote: '/ 초대 4명',
    viewerTitle: '일반 참가자 화면',
    viewerNote: '회의록을 함께 작성할 수 있지만 회의를 끝내거나 안건을 넘길 수 없습니다.',
    viewerChipLabel: '참석 처리됨 · 15:07 참가',
    viewerChipTone: 'green',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: false,
    // 진행 중부터 오는 조각. 가만히 있어도 자라는 값이라 서버가 준 그대로 그린다.
    startedAt: '15:00 시작',
    elapsedNote: '진행 27분',
    presentNote: '3명 참가 중',
  },
  'MTG-05': {
    title: '체육대회 안전 관리 최종 회의',
    description:
      '행사 전 안전 점검 결과를 공유하고 비상 연락망과 현장 안전 인력 배치를 최종 확정합니다.',
    status: '예정',
    statusTone: 'blue',
    kindLabel: '행사 관련 회의',
    kindTone: 'gray',
    eventTitle: '2026 소프트웨어융합대학 체육대회',
    eventId: 'EVT-2026-SPORTS',
    creatorNote: '박해랑 · 운영부',
    updatedNote: '2026.07.17 18:42 수정',
    scheduledAt: '2026.07.25 15:00',
    plannedDurationNote: '1시간 30분',
    place: '학생회실 (A204)',
    inviteeCountNote: '4명',
    viewerTitle: '일반 참가자 화면',
    viewerNote: '회의 정보를 확인할 수 있지만 회의를 시작하거나 설정을 변경할 수 없습니다.',
    viewerChipLabel: '예정 회의',
    viewerChipTone: 'gray',
    stateBannerTitle: '아직 회의가 시작되지 않았습니다',
    // 굽은 따옴표(U+2018/U+2019)다. design이 그렇게 그렸다.
    stateBannerNote:
      '회의가 시작되면 목록과 이 화면의 버튼이 ‘회의 참가’로 변경됩니다. 이 화면을 확인한 것은 참석으로 기록되지 않습니다.',
    stateBannerTone: 'blue',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: false,
    agendaCountNote: '총 3개 · 예상 60분',
    materialCountNote: '등록 자료 3개',
    participantCountNote: '초대 4명 · 진행 권한 2명',
  },
  'MTG-06': {
    title: '신입생 환영 행사 기획회의',
    description: '환영 행사의 진행 순서와 부서별 역할을 정리합니다.',
    eventTitle: '신입생 환영 행사',
    status: '정리 중',
    statusTone: 'yellow',
    minutesStatus: '작성 중',
    minutesStatusTone: 'yellow',
    kindLabel: '행사 관련 회의',
    kindTone: 'gray',
    creatorNote: '이수현 · 기획부',
    scheduledAt: '2026.07.15 16:00',
    place: '온라인 (Discord)',
    inviteeCountNote: '10명',
    viewerTitle: '일반 참가자 화면',
    viewerNote: '현재 내용은 진행 권한자가 수정할 수 있습니다.',
    viewerChipLabel: '15:07 참석',
    viewerChipTone: 'gray',
    stateBannerTitle: '회의록을 정리하고 있습니다',
    stateBannerNote:
      '현재 내용은 진행 권한자가 수정할 수 있습니다. 정리 완료 후 최종 회의록으로 제공됩니다.',
    stateBannerTone: 'yellow',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: false,
    // 장소는 place가 따로 갖는다. 명세가 둘을 이어 그리므로 여기 붙이면 두 번 그려진다.
    actualTimeNote: '2026.07.15 16:00–17:18',
    attendanceResultNote: '8명 참석 · 2명 불참',
    agendaCountNote: '총 5개',
  },
  // **06B가 그린 회의다.** 06A와 06B는 같은 화면인데 와이어프레임이 서로 다른
  // 회의를 그렸다 — 06A는 신입생 환영 행사(MTG-06)를, 06B는 체육대회를. 둘을 한
  // 회의로 묶으면 한쪽의 대조가 통째로 어긋나므로 그림마다 그 회의를 둔다
  // (명세의 params.example이 어느 것인지 말한다).
  //
  // 이 회의만 안건의 차례를 '안건 1'로 적는다. 06A는 같은 자리를 '1'로 그렸다 —
  // 완성된 글이라 서버가 정하는 것이지만, 한 조직 안에서 두 꼴이 나온 것은 그림의
  // 흔들림이다(보고 사항).
  'MTG-09': {
    title: '체육대회 안전 관리 최종 회의',
    description: '행사 당일 안전 관리 계획을 최종 확인합니다.',
    eventTitle: '2026 소프트웨어융합대학 체육대회',
    status: '정리 중',
    statusTone: 'yellow',
    minutesStatus: '작성 중',
    minutesStatusTone: 'yellow',
    kindLabel: '행사 관련 회의',
    kindTone: 'gray',
    creatorNote: '박해랑 · 운영부',
    scheduledAt: '15:00–16:30',
    place: '학생회관 3층 회의실',
    inviteeCountNote: '4명',
    viewerTitle: '진행 권한자 화면',
    viewerNote: '회의록을 정리하고 정리 완료를 누를 수 있습니다.',
    viewerChipLabel: '16:12 종료 처리',
    viewerChipTone: 'gray',
    stateBannerTitle: '회의가 종료되어 정리 중입니다',
    stateBannerNote:
      '정리 완료 후 참석자에게 최종 회의록이 제공되고, 불참자에게는 회의 요약 확인이 요청됩니다.',
    stateBannerTone: 'yellow',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: true,
    actualTimeNote: '15:00–16:12',
    closedByNote: '박해랑 · 16:12',
    attendanceResultNote: '3명 참석 · 1명 불참',
    agendaCountNote: '총 3개',
  },
  'MTG-07': {
    title: '가을 축제 1차 준비회의',
    description: '가을 축제 운영 방향과 부서별 준비 범위를 논의할 예정이었습니다.',
    status: '취소',
    statusTone: 'red',
    creatorNote: '김바다 · 기획부',
    scheduledAt: '2026.08.05 13:00',
    place: '미정',
    inviteeCountNote: '15명',
    viewerTitle: '일반 참가자 화면',
    viewerNote: '취소된 회의는 기록으로만 남습니다.',
    viewerChipLabel: '',
    viewerChipTone: '',
    stateBannerTitle: '이 회의는 취소되었습니다',
    stateBannerNote:
      '행사 일정 확정이 지연되어 기존 회의를 취소하고 날짜를 다시 조율합니다.',
    stateBannerTone: 'red',
    canStart: false,
    canEnd: false,
    canEdit: false,
    canCancel: false,
    canManageHostRole: false,
    canEditMinutes: false,
    cancelReason:
      '행사 일정 확정이 지연되어 참가자들이 참석 가능한 새로운 날짜를 조사한 뒤 회의를 다시 만들기로 했습니다.',
    cancelledByNote: '김바다 · 기획부',
    cancelledAtNote: '2026.07.29 11:20',
    // 굽은 따옴표(U+2018/U+2019)다. design이 그렇게 그렸고 대조는 글자를 그대로 견준다.
    replacementNote:
      '새로운 일정을 조율한 뒤 ‘가을 축제 운영 방향 회의’가 생성되었습니다.',
    replacementMeetingId: 'MTG-08',
  },
}

const MEETING_AGENDAS: Record<string, DataRow[]> = {
  'MTG-01': [
    {
      agendaId: 'AG-01-1',
      orderLabel: '1',
      title: '행사장 안전 점검 결과',
      discussionText:
        '본부석 뒤편 전선 구간에 케이블 커버를 추가하고 우천 시 실내 대기 장소를 사용하기로 했습니다.',
      decisionText: '본부석 뒤편 전선 구간에 케이블 커버를 설치합니다.',
    },
    {
      agendaId: 'AG-01-2',
      orderLabel: '2',
      title: '비상 연락망 및 담당자 확정',
      discussionText: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      decisionText: '비상 연락망은 운영본부를 중심으로 단일화합니다.',
    },
    // 결정이 나지 않은 안건에는 그 조각이 오지 않는다. 와이어프레임도 셋째
    // 카드에만 초록 상자를 그리지 않았다.
    {
      agendaId: 'AG-01-3',
      orderLabel: '3',
      title: '행사 당일 안전 인력 배치',
      discussionText: '출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.',
    },
  ],
  'MTG-04': [
    {
      agendaId: 'AG-04-1',
      orderLabel: '안건 1',
      title: '행사장 안전 점검 결과',
      description: '본부석 뒤편 전선 구간에 케이블 커버를 추가하고 우천 시 실내 대기 장소를 사용하기로 했습니다.',
      durationNote: '20분',
      status: '논의 완료',
      statusTone: 'gray',
      decisionCountNote: '결정 1',
      taskCountNote: '업무 1',
    },
    {
      agendaId: 'AG-04-2',
      orderLabel: '안건 2',
      title: '비상 연락망 및 담당자 확정',
      description: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      durationNote: '예상 15분',
      status: '진행 중',
      statusTone: 'green',
      isCurrent: true,
      decisionText:
        '비상 연락은 현장 담당자 → 운영본부 → 학생회장·학교 안전관리팀 순으로 진행합니다.',
      decisionCountNote: '결정 1',
      taskCountNote: '업무 1',
    },
    {
      agendaId: 'AG-04-3',
      orderLabel: '안건 3',
      title: '행사 당일 안전 인력 배치',
      description: '출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.',
      durationNote: '25분',
      status: '대기',
      statusTone: 'yellow',
      decisionCountNote: '결정 0',
      taskCountNote: '업무 0',
    },
  ],
  'MTG-05': [
    {
      agendaId: 'AG-05-1',
      orderLabel: '안건 1',
      title: '행사장 안전 점검 결과',
      description:
        '본부석 뒤편 전선 구간에 케이블 커버를 추가하고 우천 시 실내 대기 장소를 사용하기로 했습니다.',
      durationNote: '20분',
      status: '대기',
      statusTone: 'gray',
    },
    {
      agendaId: 'AG-05-2',
      orderLabel: '안건 2',
      title: '비상 연락망 및 담당자 확정',
      description: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      durationNote: '15분',
      status: '대기',
      statusTone: 'gray',
    },
    {
      agendaId: 'AG-05-3',
      orderLabel: '안건 3',
      title: '행사 당일 안전 인력 배치',
      description: '출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.',
      durationNote: '25분',
      status: '대기',
      statusTone: 'gray',
    },
  ],
  'MTG-06': [
    {
      agendaId: 'AG-06-1',
      orderLabel: '1',
      title: '행사 프로그램 구성',
      description: '식순과 각 순서의 담당을 정합니다.',
      status: '정리됨',
      statusTone: 'green',
      summaryLine: '환영 인사, 학과 소개, 아이스브레이킹, 부서별 교류 순으로 진행합니다.',
      decisionText: '프로그램 순서는 환영 인사 이후 학과 소개와 교류 프로그램 순으로 진행합니다.',
    },
    {
      agendaId: 'AG-06-2',
      orderLabel: '2',
      title: '장소와 참가자 동선',
      status: '정리됨',
      statusTone: 'green',
      summaryLine: '답사 결과를 반영해 입장과 퇴장 동선을 분리하는 방안을 검토합니다.',
    },
    {
      agendaId: 'AG-06-3',
      orderLabel: '3',
      title: '부서별 준비 범위',
      status: '정리 중',
      statusTone: 'yellow',
      summaryLine: '운영부는 현장 운영, 홍보부는 사전 안내와 행사 기록을 담당합니다.',
      decisionEmptyNote:
        '아직 결정사항이 정리되지 않았습니다. 오른쪽 패널에서 작성하거나 결정사항 없음을 선택하세요.',
    },
  ],
  // 06B가 그린 안건 셋. **논의 내용과 결정을 통째로 편다** — 06A는 한 줄 요약만
  // 그리므로 discussionText·durationNote가 거기서는 오지 않는다.
  'MTG-09': [
    {
      agendaId: 'AG-09-1',
      orderLabel: '안건 1',
      title: '행사장 안전 점검 결과',
      description:
        '본부석 뒤편 전선 구간에 케이블 커버를 추가하고 우천 시 실내 대기 장소를 사용하기로 했습니다.',
      durationNote: '20분',
      status: '정리 필요',
      statusTone: 'yellow',
      discussionText:
        '• 본부석 뒤편 전선 구간이 주요 위험 요소로 확인됨 • 우천 시 실외 대기 구역 사용이 어려워 대체 공간이 필요함 • 경기장 출입구 주변에 안전 안내 표지를 추가하기로 의견을 모음',
      decisionText:
        '본부석 뒤편 전선 구간에 케이블 커버를 설치하고, 우천 시 학생회관 1층을 대기 장소로 사용합니다.',
    },
    {
      agendaId: 'AG-09-2',
      orderLabel: '안건 2',
      title: '비상 연락망 및 담당자 확정',
      description: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      durationNote: '15분',
      status: '정리 필요',
      statusTone: 'yellow',
      discussionText:
        '• 응급 상황 발생 시 현장 담당자가 운영본부로 1차 연락 • 운영본부에서 학생회장과 학교 안전관리팀에 동시 보고 • 경기별 안전 담당자 연락처를 참가자 안내문에 포함',
      decisionText:
        '비상 연락은 현장 담당자 → 운영본부 → 학생회장·학교 안전관리팀 순으로 진행합니다.',
    },
    {
      agendaId: 'AG-09-3',
      orderLabel: '안건 3',
      title: '행사 당일 안전 인력 배치',
      description: '출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.',
      durationNote: '25분',
      status: '정리 필요',
      statusTone: 'yellow',
      isCurrent: true,
      discussionText:
        '• 출입구와 경기장별 필요 인원을 확인하는 중 • 대기 구역 담당 인원은 참가 신청 결과를 본 뒤 확정 필요',
      // 아직 결정이 없는 안건. **없다는 말도 서버가 준다** — 무엇을 하라고 이르는
      // 문장이라 조직의 것이다.
      decisionEmptyNote:
        '아직 결정사항이 정리되지 않았습니다. 오른쪽 패널에서 작성하거나 \u2018결정사항 없음\u2019을 선택하세요.',
    },
  ],
}

// 06B가 그린 후속 업무 셋. **어느 안건의 것인지를 말하는 조각이 카탈로그에 없다**
// — 그림은 안건마다 하나씩 그렸는데 출처는 회의의 것을 통째로 준다. 그래서 화면이
// 안건별로 가르지 못하고 세 줄을 그대로 그린다(design/deviations.ts).
const MEETING_FOLLOW_UPS_MTG09: DataRow[] = [
  { taskId: 'TSK-09-1', title: '케이블 커버와 안전 안내 표지 구매', assigneeNote: '박해랑 · 07.22' },
  { taskId: 'TSK-09-2', title: '비상 연락망 최종본 배포', assigneeNote: '정하늘 · 07.23' },
  { taskId: 'TSK-09-3', title: '안전 인력 배치안 확정', assigneeNote: '박해랑 · 07.24' },
]

const MEETING_PARTICIPANTS: Record<string, DataRow[]> = {
  'MTG-01': [
    {
      memberId: 'M-01',
      name: '박해랑',
      department: '운영부',
      departmentNote: '운영부 · 회의 참가자',
      chips: [],
      attendanceLabel: '15:00 참석',
      attendanceTone: 'green',
    },
    {
      memberId: 'M-02',
      name: '정하늘',
      department: '운영부',
      departmentNote: '운영부 · 회의 참가자',
      chips: [],
      attendanceLabel: '15:02 참석',
      attendanceTone: 'green',
    },
    {
      memberId: 'M-03',
      name: '이수현',
      department: '기획부',
      departmentNote: '기획부 · 회의 참가자',
      chips: [],
      attendanceLabel: '15:07 참석',
      attendanceTone: 'green',
    },
    {
      memberId: 'M-04',
      name: '김민준',
      department: '재정부',
      departmentNote: '재정부 · 회의 참가자',
      chips: [],
      attendanceLabel: '불참',
      attendanceTone: 'gray',
    },
  ],
  'MTG-04': [
    {
      memberId: 'M-01',
      name: '박해랑',
      department: '운영부',
      departmentNote: '운영부 · 회의 참가자',
      chips: [{ label: '진행 권한', tone: 'blue' }],
      capabilityNote: '시작·종료 가능',
      attendanceLabel: '15:00 참가',
      attendanceTone: 'green',
      isPresent: true,
    },
    {
      memberId: 'M-02',
      name: '정하늘',
      department: '운영부',
      departmentNote: '운영부 · 회의 참가자',
      chips: [{ label: '진행 권한', tone: 'blue' }],
      capabilityNote: '시작·종료 가능',
      attendanceLabel: '15:02 참가',
      attendanceTone: 'green',
      isPresent: true,
    },
    {
      memberId: 'M-03',
      name: '이수현',
      department: '기획부',
      departmentNote: '기획부 · 회의 참가자',
      chips: [],
      capabilityNote: '일반 참가자',
      attendanceLabel: '15:07 참가',
      attendanceTone: 'green',
      isPresent: true,
    },
    {
      memberId: 'M-04',
      name: '김민준',
      department: '재정부',
      departmentNote: '재정부 · 회의 참가자',
      chips: [],
      capabilityNote: '일반 참가자',
      attendanceLabel: '미참석',
      attendanceTone: 'gray',
    },
  ],
  'MTG-05': [
    {
      memberId: 'M-01',
      name: '박해랑',
      department: '운영부',
      departmentNote: '운영부 · 회의 참가자',
      chips: [
        { label: '회의 생성자', tone: 'gray' },
        { label: '진행 권한', tone: 'blue' },
      ],
      capabilityNote: '시작·종료 가능',
    },
    {
      memberId: 'M-02',
      name: '정하늘',
      department: '운영부',
      departmentNote: '운영부 · 회의 참가자',
      chips: [{ label: '진행 권한', tone: 'blue' }],
      capabilityNote: '시작·종료 가능',
      actionLabel: '권한 해제',
      actionEmphasis: 'secondary',
      actionEnabled: 'y',
    },
    {
      memberId: 'M-03',
      name: '이수현',
      department: '기획부',
      departmentNote: '기획부 · 회의 참가자',
      chips: [],
      capabilityNote: '일반 참가자',
      actionLabel: '진행 권한 부여',
      actionEmphasis: 'primary',
      actionEnabled: 'y',
    },
    {
      memberId: 'M-04',
      name: '김민준',
      department: '재정부',
      departmentNote: '재정부 · 회의 참가자',
      chips: [],
      capabilityNote: '일반 참가자',
      actionLabel: '진행 권한 부여',
      actionEmphasis: 'primary',
      actionEnabled: 'y',
    },
    {
      memberId: 'M-05',
      name: '이윤슬',
      department: '홍보부',
      departmentNote: '홍보부 · 회의 참가자',
      chips: [],
      capabilityNote: '일반 참가자',
      actionLabel: '진행 권한 부여',
      actionEmphasis: 'primary',
      actionEnabled: 'y',
    },
    {
      memberId: 'M-06',
      name: '김바다',
      department: '기획부',
      departmentNote: '기획부 · 회의 참가자',
      chips: [],
      capabilityNote: '일반 참가자',
      actionLabel: '진행 권한 부여',
      actionEmphasis: 'primary',
      actionEnabled: 'y',
    },
  ],
}

// 회의를 만든 사람. 목록의 같은 사람과 값이 다르다 - 04B는 '권한 변경 및 회의
// 관리 가능'이라 적고 03A는 '시작·종료 가능'이라 적는다.
const MEETING_FOLLOW_UPS: Record<string, DataRow[]> = {
  'MTG-04': [
    {
      taskId: 'TASK-04-1',
      title: '비상 연락망 최종본 배포',
      assigneeNote: '정하늘 · 07.23까지 · 위 결정사항에서 생성',
    },
  ],
}

const MEETING_HOST_OWNER: Record<string, DataRow> = {
  'MTG-05': {
    name: '박해랑',
    departmentNote: '운영부 · 권한 변경 및 회의 관리 가능',
    chips: [
      { label: '회의 생성자', tone: 'gray' },
      { label: '진행 권한', tone: 'blue' },
    ],
    capabilityNote: '필수 권한자',
  },
}

// 회의 생성·수정 화면이 처음 받는 값(OPS-MEET-02). 값은 figma.design.json이 그린
// 예시를 그대로 옮긴 것이라 구현 화면과 reference.png를 눈으로 대조할 수 있다.
//
// **MEETING_DETAIL과 사람이 다르다.** 이 그림에서 회의를 만드는 사람은 이수현이고
// 03·05·07이 그린 회의의 생성자는 박해랑이다. 와이어프레임이 그렇게 그렸고,
// 픽스처가 그림을 대신하는 자리이므로 그대로 옮긴다.
const MEETING_DRAFT: Record<string, DataRow> = {
  'MTG-05': {
    title: '체육대회 안전 관리 최종 회의',
    hostName: '이수현',
    statusLabel: '예정',
    meetingType: 'event',
    place: '학생회실 (A204)',
    participants: [
      {
        memberId: 'M-03',
        name: '이수현',
        departmentNote: '기획부',
        chips: [
          { label: '회의 생성자', tone: 'gray' },
          { label: '진행 권한', tone: 'blue' },
        ],
      },
      {
        memberId: 'M-01',
        name: '박해랑',
        departmentNote: '운영부',
        chips: [{ label: '진행 권한', tone: 'blue' }],
        actionLabel: '권한 해제',
        actionEmphasis: 'danger',
        canRemove: true,
      },
      {
        memberId: 'M-02',
        name: '정하늘',
        departmentNote: '운영부',
        chips: [{ label: '진행 권한', tone: 'blue' }],
        actionLabel: '권한 해제',
        actionEmphasis: 'danger',
        canRemove: true,
      },
      {
        memberId: 'M-04',
        name: '김민준',
        departmentNote: '재정부',
        chips: [],
        actionLabel: '진행 권한 부여',
        actionEmphasis: 'primary',
        canRemove: true,
      },
    ],
    agendaItems: [
      { agendaTitle: '행사장 안전 점검 결과', attachmentName: '체육대회_안전점검표.pdf' },
      { agendaTitle: '비상 연락망 및 담당자 확정', attachmentName: '' },
      { agendaTitle: '행사 당일 안전 인력 배치', attachmentName: '안전인력_배치초안.xlsx' },
    ],
  },
}

const MEETING_CANDIDATES: DataRow[] = [
  { memberId: 'M-01', name: '박해랑', departmentNote: '운영부', alreadyAdded: 'y' },
  { memberId: 'M-02', name: '정하늘', departmentNote: '운영부', alreadyAdded: 'y' },
  { memberId: 'M-03', name: '이수현', departmentNote: '기획부', alreadyAdded: 'y' },
  { memberId: 'M-04', name: '김민준', departmentNote: '재정부', alreadyAdded: 'y' },
  { memberId: 'M-05', name: '이윤슬', departmentNote: '기획부' },
  { memberId: 'M-06', name: '김바다', departmentNote: '기획부' },
]

const MEETING_DOCUMENTS: Record<string, DataRow[]> = {
  // 07의 '관련 자료'는 회의 전체에 붙은 것이라 agendaId가 없다.
  'MTG-01': [
    { documentId: 'DOC-1', name: '체육대회_안전점검표.pdf' },
    { documentId: 'DOC-2', name: '비상연락망_초안.xlsx' },
    { documentId: 'DOC-3', name: '안전인력_배치초안.xlsx' },
  ],
  'MTG-04': [
    { documentId: 'DOC-4', name: '비상연락망_초안.xlsx', agendaId: 'AG-04-2' },
  ],
  'MTG-05': [
    { documentId: 'DOC-1', name: '체육대회_안전점검표.pdf', agendaId: 'AG-05-1' },
    { documentId: 'DOC-2', name: '비상연락망_초안.xlsx', agendaId: 'AG-05-2' },
    { documentId: 'DOC-3', name: '안전인력_배치초안.xlsx', agendaId: 'AG-05-3' },
  ],
}

export const FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 미배정 구성원은 이름으로 거른다. 조직도를 고치는 화면(ORG-03B)의 오른쪽 칸이다.
  // 부서는 이름으로 좁혀 볼 수 있다(MSG-02의 '이름 검색'). 부서 이름을 찾는 것인지
  // 그 안의 사람 이름을 찾는 것인지 그림이 말하지 않아 서버가 정한다 — 개발용
  // 응답은 부서 이름만 본다(matchesQuery가 중첩 목록을 들여다보지 않는다).
  'org.departments': ({ query = '' }) =>
    ORG_DEPARTMENTS.filter((row) => matchesQuery(row, query)),
  'org.unassignedMembers': ({ query = '' }) =>
    UNASSIGNED_MEMBERS.filter((row) => matchesQuery(row, query)),
  // 학생 명단은 이름·학번으로 찾고 학년·납부 상태로 거른다.
  'org.students': ({ query = '', grade = '', duesStatus = '' }) =>
    STUDENT_ROSTER.filter((row) => matchesQuery(row, query))
      .filter((row) => grade === '' || row.grade === grade)
      .filter(
        (row) =>
          duesStatus === '' ||
          duesStatus === 'all' ||
          row.duesLabel === DUES_BY_STATUS[duesStatus],
      ),
  'org.studentPaging': ({ query = '', grade = '', duesStatus = '' }) => {
    const rows = (FILTERED_FIXTURES['org.students'] as (p: Record<string, string>) => DataRow[])({
      query,
      grade,
      duesStatus,
    })
    // 총 건수는 거른 뒤의 것이다 - 화면이 세지 않고 서버가 말한다.
    return [{ totalNote: `총 ${rows.length}명`, pageCount: 1 }]
  },
  'task.board': ({ scope = 'all', status = 'planned' }) =>
    TASK_BOARD.filter((task) => task.status === status)
      .filter((task) => scope !== 'mine' || task.row.assignee === VIEWER_NAME)
      .map((task) => task.row),
  // 검색은 묶음이 아니라 회의를 거른다. 남는 회의가 없는 묶음은 통째로 사라진다 —
  // 빈 묶음 머리만 남으면 '총 0건'이 줄줄이 보인다.
  // 회의 한 건. 인자가 가리킨 회의가 없으면 빈 것을 돌려준다 - 조용히 다른
  // 회의를 대신 보여주면 사람이 남의 회의를 자기 것으로 읽는다.
  'meeting.detail': ({ meetingId = '' }) => {
    const row = MEETING_DETAIL[meetingId]
    return row === undefined ? [] : [row]
  },
  'meeting.agendas': ({ meetingId = '' }) => MEETING_AGENDAS[meetingId] ?? [],
  // 참가자는 03·05·07의 목록과 04B의 권한 관리가 같은 사람들이다. 검색은 04B만
  // 쓰지만 출처가 하나이므로 여기서 함께 거른다.
  'meeting.participants': ({ meetingId = '', query = '', excludeHostOwner = 'false' }) =>
    (MEETING_PARTICIPANTS[meetingId] ?? [])
      .filter((row) => excludeHostOwner !== 'true' || row.memberId !== 'M-01')
      .filter((row) => matchesQuery(row, query)),
  'meeting.hostOwner': ({ meetingId = '' }) => {
    const row = MEETING_HOST_OWNER[meetingId]
    return row === undefined ? [] : [row]
  },
  'meeting.documents': ({ meetingId = '' }) => MEETING_DOCUMENTS[meetingId] ?? [],
  // 후속 업무는 와이어프레임이 빈 상태만 그렸다. 지어내지 않는다.
  'meeting.followUps': ({ meetingId = '' }) =>
    meetingId === 'MTG-09' ? MEETING_FOLLOW_UPS_MTG09 : (MEETING_FOLLOW_UPS[meetingId] ?? []),
  // **다른 물음이라 따로 답한다.** 위는 '이 회의가 만든 후속 업무'이고 이것은
  // '그중 내 것'이다. 그림이 둘 다 0건을 그렸으므로 여기도 빈 목록이다 — 비었을 때
  // 뭐라고 말하는지가 둘의 다름을 드러낸다.
  'meeting.myFollowUps': () => [],
  'meeting.minutes': ({ meetingId = '' }) =>
    meetingId === 'MTG-01'
      ? [
          {
            summaryText:
              '체육대회 안전 점검 결과를 바탕으로 위험 구간 조치 방안을 확정했습니다. 비상 연락은 현장 담당자에서 운영본부를 거쳐 학생회장과 학교 안전관리팀에 보고하며, 경기별 안전 담당자 명단은 7월 23일까지 전체 운영진에게 배포합니다.',
          },
        ]
      : meetingId === 'MTG-09'
      ? [
          {
            // 아직 요약이 없는 회의. **없다는 말도 서버가 준다.**
            summaryText: '아직 작성된 전체 요약이 없습니다',
            statusLabel: '정리 중 · 변경될 수 있음',
            statusTone: 'yellow',
            aiDisclaimer:
              'AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다.\n요약이 없어도 정리 완료가 막히지는 않습니다.',
          },
        ]
      : meetingId === 'MTG-06'
      ? [
          {
            summaryText:
              '신입생 환영 행사 프로그램 순서와 부서별 준비 범위를 논의했습니다. 장소 답사 후 세부 동선과 무대 운영 계획을 최종 확정할 예정입니다.',
            statusLabel: '정리 중 · 변경될 수 있음',
            statusTone: 'yellow',
            aiDisclaimer:
              'AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다. 요약이 없어도 정리 완료가 막히지는 않습니다.',
          },
        ]
      : [],
  'meeting.minutesProgress': ({ meetingId = '' }) =>
    meetingId === 'MTG-09'
      ? [
          {
            requiredDoneNote: '필수 2 / 4',
            blockedNote: '안건별 필수 정리를 완료해 주세요',
            canComplete: false,
            // 그림이 그린 글 그대로다. '(선택)'까지 서버가 붙여 온다 — 무엇이
            // 없어도 되는지는 조직의 규칙이고, 화면이 optional을 보고 그 말을
            // 지어내면 그 규칙이 화면에 적힌다.
            conditions: [
              { label: '안건별 논의 내용', done: 'y', optional: '' },
              { label: '결정사항 또는 없음 표시', done: '', optional: '' },
              { label: '후속 업무 또는 없음 표시', done: '', optional: '' },
              { label: '참가 결과', done: 'y', optional: '' },
              { label: '회의 전체 요약 (선택)', done: '', optional: 'y' },
            ],
          },
        ]
      : meetingId === 'MTG-06'
      ? [
          {
            requiredDoneNote: '필수 2 / 4',
            blockedNote: '안건별 필수 정리를 완료해 주세요',
            canComplete: false,
            conditions: [
              { label: '안건별 논의 내용', done: 'y', optional: '' },
              { label: '결정사항 또는 없음 표시', done: '', optional: '' },
              { label: '후속 업무 또는 없음 표시', done: '', optional: '' },
              { label: '참가 결과', done: 'y', optional: '' },
              { label: '회의 전체 요약', done: '', optional: 'y' },
            ],
          },
        ]
      : [],
  // 회의록의 각 부분이 어디까지 왔는지. **위의 minutesProgress와 다른 물건이다** —
  // 저것은 마칠 수 있는가를 조건으로 세고, 이것은 부분마다 어디까지 왔는지 말한다.
  // 세는 단위가 부분마다 다르므로(개·건·초안) 완성된 문구로 온다.
  'meeting.minutesStatus': ({ meetingId = '' }) =>
    meetingId === 'MTG-06'
      ? [
          {
            parts: [
              { label: '안건 내용', stateNote: '2 / 3 정리' },
              { label: '의사결정', stateNote: '2건 확인' },
              { label: '후속 업무', stateNote: '1건 연결' },
              { label: '전체 요약', stateNote: '초안 작성' },
            ],
          },
        ]
      : [],
  // 권한 안내는 04B의 띠와 D03의 확인 글이 나눠 쓴다.
  'meeting.permissionNotice': ({ meetingId = '' }) =>
    MEETING_DETAIL[meetingId] === undefined
      ? []
      : [
          {
            title: '이 회의에만 적용되는 권한입니다',
            grantNote:
              '진행 권한자는 회의 시작·종료, 안건 진행, 결정 기록과 회의록 정리를 할 수 있습니다.',
            limitNote:
              '회의 수정·취소와 다른 사람의 권한 변경은 회의 생성자만 할 수 있습니다.',
            ruleChipLabel: '최소 1명 유지',
            ruleChipTone: 'yellow',
            summaryNote: '현재 진행 권한자 2명 · 일반 참가자 3명',
          },
        ],
  'meeting.startConfirm': () => [
    {
      warningNote:
        '예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.',
    },
  ],
  'meeting.endConfirm': () => [
    { warningNote: '미완료 안건 1개 · 참석 3명 · 미참가 1명' },
  ],
  // 제목에 사람 이름이 박혀 있으므로 서버가 완성해 준다.
  'meeting.hostGrantConfirm': ({ meetingId = '', memberId = '' }) => {
    const person = (MEETING_PARTICIPANTS[meetingId] ?? []).find(
      (row) => row.memberId === memberId,
    )
    return person === undefined
      ? []
      : [
          {
            title: `${String(person.name)}에게 진행 권한을 부여할까요?`,
            grantNote:
              '이 회의에서 회의 시작·종료, 안건 진행, 의사결정 기록과 회의록 정리를 할 수 있게 됩니다.',
            limitNote:
              '회의 수정·취소와 다른 참가자의 권한 변경은 할 수 없습니다.',
          },
        ]
  },
  // 회의를 새로 쓸 때는 서버가 아는 것만 채워 온다.
  // 새로 쓰면 서버가 아는 것만 채워 온다. 고치러 들어오면 그 회의를 통째로 준다.
  'meeting.draft': ({ meetingId = '' }) =>
    meetingId === ''
      ? [{ hostName: '박해랑', statusLabel: '예정' }]
      : [MEETING_DRAFT[meetingId] ?? { hostName: '박해랑', statusLabel: '예정' }],
  'meeting.memberCandidates': ({ query = '' }) =>
    MEETING_CANDIDATES.filter((row) => matchesQuery(row, query)),
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
  // 인자가 가리키는 행사에 아직 QR이 없으면 빈 목록이고, 그것은 '개발용 응답이
  // 없다'가 아니라 **아직 만들지 않았다**다(readDataSource가 NOT_FOUND로 가른다).
  // 밖에서 온 사람이 QR로 찾는다. 토큰이 가리키는 것이 없으면 빈 목록이고, 그것은
  // '개발용 응답이 없다'가 아니라 **찾지 못했다**다.
  'attendance.checkInForm': ({ checkInToken = '' }) => {
    const row = ATTENDANCE_CHECK_IN_FORM[checkInToken]
    return row === undefined ? [] : [row]
  },
  // **영수증으로 찾는다.** QR의 토큰으로 찾으면 같은 QR을 찍은 여러 사람이 서로의
  // 이름과 결과를 본다 — 열쇠가 사람마다 달라야 한다.
  'attendance.checkInResult': ({ receiptToken = '' }) => {
    const row = ATTENDANCE_CHECK_IN_RESULT[receiptToken]
    return row === undefined ? [] : [row]
  },
  'event.attendanceQr': ({ eventId = '' }) => {
    const row = EVENT_ATTENDANCE_QR[eventId]
    return row === undefined ? [] : [row]
  },
  'event.basicsDraft': ({ eventId = '' }) => {
    const row = EVENT_BASICS_DRAFT[eventId]
    return row === undefined ? [] : [row]
  },
  'event.survey': ({ eventId = '' }) => {
    const row = EVENT_SURVEY[eventId]
    return row === undefined ? [] : [row]
  },
  'event.surveySettingsDraft': ({ eventId = '' }) => {
    const row = EVENT_SURVEY_SETTINGS_DRAFT[eventId]
    return row === undefined ? [] : [row]
  },
  'event.surveyActivation': ({ eventId = '' }) => {
    const row = EVENT_SURVEY_ACTIVATION[eventId]
    return row === undefined ? [] : [row]
  },
  'event.surveyActivationConditions': ({ eventId = '' }) =>
    EVENT_SURVEY_ACTIVATION_CONDITIONS[eventId] ?? [],
  'event.surveyQuestions': ({ eventId = '' }) => EVENT_SURVEY_QUESTIONS[eventId] ?? [],
  'event.surveyReplaceImpact': ({ eventId = '' }) => {
    const row = EVENT_SURVEY_REPLACE_IMPACT[eventId]
    return row === undefined ? [] : [row]
  },
  'survey.applyForm': ({ surveyToken = '' }) => {
    const row = SURVEY_APPLY_FORM[surveyToken]
    return row === undefined ? [] : [row]
  },
  // 영수증으로 찾는다(attendance.checkInResult와 같은 까닭).
  'survey.applyResult': ({ receiptToken = '' }) => {
    const row = SURVEY_APPLY_RESULT[receiptToken]
    return row === undefined ? [] : [row]
  },
  'survey.linkState': ({ surveyToken = '' }) => {
    const row = SURVEY_LINK_STATE[surveyToken]
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
  'finance.orgBreakdown': ({ scope = 'event' }) => ORG_BREAKDOWN[scope] ?? [],
  'finance.ledger': (params) => ledgerEntriesOf(params).map((entry) => entry.row),
  // 유형으로 좁히는 것은 **일정**이지 날이 아니다. 칸은 그대로 서른넷이고
  // 그 안의 일정만 걸린다 — 격자에서 날이 사라지면 달력이 아니게 된다.
  // 없는 코드면 빈 목록이고, 그것은 '개발용 응답이 없다'가 아니라 **그런 학생회가
  // 없다**다(readDataSource가 NOT_FOUND로 가른다).
  'org.invitedOrganization': ({ inviteCode = '' }) => {
    const row = INVITED_ORGANIZATIONS[inviteCode]
    return row === undefined ? [] : [row]
  },
  'ops.calendarDays': ({ type = 'all' }) =>
    CALENDAR_DAYS.map((day) => ({
      id: day.id,
      dayLabel: day.dayLabel,
      dayTone: day.dayTone,
      schedules: day.schedules
        .filter((schedule) => type === 'all' || schedule.type === type)
        .map((schedule) => ({ id: schedule.id, title: schedule.title, typeTone: schedule.type })),
    })),
//
//   // 완료된 행사는 행사명으로 좁혀 본다. event.list와 다른 목록이다.
//   'record.completedEvents': ({ query = '' }) =>
//     COMPLETED_EVENTS.filter((row) => matchesQuery(row, query)),
//   'record.archive': ({ eventId = '' }) => {
//     const row = RECORD_ARCHIVES[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveSections': ({ eventId = '' }) => RECORD_ARCHIVE_SECTIONS[eventId] ?? [],
//   // 발행된 문서의 본문은 한 벌만 손으로 적는다. 검토 중인 문서를 따로 그린
//   // 프레임이 없으므로 지어내지 않고 같은 것을 준다.
//   'record.archiveDetail': ({ eventId = '' }) =>
//     RECORD_ARCHIVES[eventId] === undefined || eventId === 'E-REC-03' ? [] : [ARCHIVE_DETAIL],
//   'record.archiveTimeline': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_TIMELINE : [],
//   'record.archiveEvidence': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_EVIDENCE : [],
//   'record.archiveRetro': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_RETRO : [],
//   'record.archiveHandover': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_HANDOVER : [],
//   'record.archiveChecklist': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_CHECKLIST : [],
//   'record.archiveAutoFilled': ({ eventId = '' }) => {
//     const row = ARCHIVE_AUTO_FILLED[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveDraft': ({ eventId = '' }) => {
//     const row = ARCHIVE_DRAFTS[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveGate': ({ eventId = '' }) => {
//     const row = ARCHIVE_GATE[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveGateConditions': ({ eventId = '' }) =>
//     ARCHIVE_GATE[eventId] === undefined ? [] : ARCHIVE_GATE_CONDITIONS,
//   'record.archiveReview': ({ eventId = '' }) => {
//     const row = ARCHIVE_REVIEWS[eventId]
//     return row === undefined ? [] : [row]
//   },
  // 완료된 행사는 행사명으로 좁혀 본다. event.list와 다른 목록이다.
  'record.completedEvents': ({ query = '' }) =>
    COMPLETED_EVENTS.filter((row) => matchesQuery(row, query)),
  'record.archive': ({ eventId = '' }) => {
    const row = RECORD_ARCHIVES[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveSections': ({ eventId = '' }) => RECORD_ARCHIVE_SECTIONS[eventId] ?? [],
  // 발행된 문서의 본문은 한 벌만 손으로 적는다. 검토 중인 문서를 따로 그린
  // 프레임이 없으므로 지어내지 않고 같은 것을 준다.
  'record.archiveDetail': ({ eventId = '' }) =>
    RECORD_ARCHIVES[eventId] === undefined || eventId === 'E-REC-03' ? [] : [ARCHIVE_DETAIL],
  'record.archiveTimeline': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_TIMELINE : [],
  'record.archiveEvidence': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_EVIDENCE : [],
  'record.archiveRetro': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_RETRO : [],
  'record.archiveHandover': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_HANDOVER : [],
  'record.archiveChecklist': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_CHECKLIST : [],
  'record.archiveAutoFilled': ({ eventId = '' }) => {
    const row = ARCHIVE_AUTO_FILLED[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveDraft': ({ eventId = '' }) => {
    const row = ARCHIVE_DRAFTS[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveGate': ({ eventId = '' }) => {
    const row = ARCHIVE_GATE[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveGateConditions': ({ eventId = '' }) =>
    ARCHIVE_GATE[eventId] === undefined ? [] : ARCHIVE_GATE_CONDITIONS,
  'record.archiveReview': ({ eventId = '' }) => {
    const row = ARCHIVE_REVIEWS[eventId]
    return row === undefined ? [] : [row]
  },
  'ops.calendarWeek': ({ type = 'all' }) =>
    CALENDAR_WEEK.filter((entry) => type === 'all' || entry.type === type).map(
      (entry) => entry.row,
    ),
  'finance.ledgerSummary': ({ month = '' }) => [
    LEDGER_SUMMARY[month || DEFAULT_LEDGER_MONTH] ?? LEDGER_SUMMARY[DEFAULT_LEDGER_MONTH],
  ],
  // '총 42건 중 최근 10건'을 손으로 적지 않는다 — 보여 준 줄에서 센다. 총 건수만
  // 서버가 아는 값이라 달마다 적어 둔다(목록은 잘려서 오므로 자기가 못 센다).
  'finance.ledgerScope': (params) => {
    const known = LEDGER_MONTHS[params.month || DEFAULT_LEDGER_MONTH]
    const shown = ledgerEntriesOf(params).length
    const stageNote = LEDGER_STAGE_NOTE[params.stage ?? '']
    return [
      {
        rangeNote:
          stageNote === undefined
            ? `${known.label} · 총 ${known.total}건 중 최근 ${shown}건 표시`
            : `${known.label} · ${stageNote} ${shown}건`,
        handlingNote: LEDGER_HANDLING_NOTE,
      },
    ]
  },
  'finance.purchaseRequestHistory': ({ requestId = '' }) =>
    PURCHASE_REQUEST_HISTORY[requestId] ?? [],
  'my.tasks': ({ tab = 'todo', query = '' }) =>
    MY_TASKS.filter((task) => task.tab === tab)
      .map((task) => task.row)
      .filter((row) => matchesQuery(row, query)),
}


