import type { DataRow } from '../../data-sources/definitions'

// 행사 목록(EVT-00A 20:4167). 완료된 행사는 이 목록에 오지 않는다 — 머리의 별도
// 이동이 그것을 본다. 딱지(highlights)는 행사마다 개수가 다르다.
export const EVENT_LIST: { status: string; row: DataRow }[] = [
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
export const EVENT_TASK_BOARD: Array<{ eventId: string; status: string; row: DataRow }> = [
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
export const EVENT_OVERVIEW: Record<string, Record<string, DataRow>> = {
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

export const EVENT_CHECKLIST: Record<string, DataRow[]> = {
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

export const EVENT_RECENT_CHANGES: Record<string, DataRow[]> = {
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
export const EVENT_DOCUMENTS: Array<{ eventId: string; status: string; row: DataRow }> = [
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

export const EVENT_DOCUMENT_STATS: Record<string, DataRow> = {
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
export const EVENT_MEETINGS: Array<{ eventId: string; row: DataRow }> = [
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

export const EVENT_MEETING_COUNTS: Record<string, DataRow> = {
  'E-01': { countsNote: '진행 중 1건 · 예정 1건 · 정리 중 0건 · 완료 1건' },
}

// 행사 참가자. 학생회 구성원이 아닐 수 있어 조직 명단과 다른 것이다.
export const EVENT_PARTICIPANTS: Array<{ eventId: string; row: DataRow }> = [
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
export const PARTICIPANT_PAGE_SIZE = 20

// 행사 재정. 금액은 자릿점까지 찍힌 글로 온다 — 화폐 표기는 조직·지역의 것이다.
export const EVENT_FINANCE_SUMMARY: Record<string, DataRow> = {
  'E-01': {
    budget: '3,000,000',
    committed: '1,100,000',
    spent: '950,000',
    available: '950,000',
  },
}

export const EVENT_FINANCE_ALERTS: Record<string, DataRow> = {
  'E-01': { pendingReviewCount: 1 },
}

// 처리 단계는 명세에 고정이고(디자인이 네 열을 그린다) 각 열에 몇 장이 오는지가
// 데이터에 달렸다. 행사 업무 보드와 같은 모양이다.
export const EVENT_FINANCE_BOARD: Array<{ eventId: string; stage: string; row: DataRow }> = [
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

// 행사 일정. 원본은 여기가 아니다 — 업무·회의·행사 기본정보가 각자 원본이고 이
// 목록은 그것이 비친 것이다. 그래서 줄마다 originNote가 어디를 고쳐야 하는지 말한다.
//
// buckets는 서버가 답을 아는 자리를 흉내 낸 것이다. '이번 주'는 오늘이 언제냐에
// 달렸고 그것은 화면도 이 붙박이 값도 모른다 — 그래서 어느 묶음에 드는지를 미리
// 적어 둔다.
export const EVENT_SCHEDULE: Array<{ eventId: string; buckets: string[]; row: DataRow }> = [
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

export const EVENT_WORKSPACES: Record<string, DataRow> = {
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

export const EVENT_SUMMARIES: Record<string, DataRow> = {
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
export const WRAP_UP_EVENT = 'E-02'

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
export const EVENT_WRAP_UP_BANNER: Record<string, DataRow> = {
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
export const EVENT_WRAP_UP_COUNTS: Record<string, DataRow> = {
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
export const EVENT_WRAP_UP_REMAINING: Record<string, DataRow[]> = {
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
