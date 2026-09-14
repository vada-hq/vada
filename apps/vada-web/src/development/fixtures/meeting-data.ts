import type { DataRow } from '../../data-sources/definitions'

// 보는 사람. 실제로는 서버가 세션에서 안다.

// 회의 목록(OPS-MEET-01A). 묶음 하나가 행사 하나이고, 어디에도 속하지 않는 회의는
// '정기·상시 회의' 묶음으로 온다.
export const MEETING_GROUPS: DataRow[] = [
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

// -- 회의 한 건 --------------------------------------------------------------
//
// 와이어프레임이 상세를 그린 회의는 셋이다: 안전 관리 최종 회의(MTG-05, 03·05·07·08),
// 신입생 환영 행사 기획회의(MTG-06, 06A), 가을 축제 1차 준비회의(MTG-07, 09가 그린
// 취소된 회의). 목록의 일곱과 같은 id를 쓴다 - 줄을 누르면 그 회의로 가야 한다.
//
// **조각이 상태마다 다르다.** 예정 회의에 startedAt이 없고 취소된 회의에만
// cancelReason이 있다. 명세가 출처 하나로 두고 없는 것은 안 보내기로 한 그대로다.

export const MEETING_DETAIL: Record<string, DataRow> = {
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

export const MEETING_AGENDAS: Record<string, DataRow[]> = {
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
      statusTone: 'yellow',
    },
    {
      agendaId: 'AG-05-2',
      orderLabel: '안건 2',
      title: '비상 연락망 및 담당자 확정',
      description: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      durationNote: '15분',
      status: '대기',
      statusTone: 'yellow',
    },
    {
      agendaId: 'AG-05-3',
      orderLabel: '안건 3',
      title: '행사 당일 안전 인력 배치',
      description: '출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.',
      durationNote: '25분',
      status: '대기',
      statusTone: 'yellow',
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
export const MEETING_FOLLOW_UPS_MTG09: DataRow[] = [
  { taskId: 'TSK-09-1', title: '케이블 커버와 안전 안내 표지 구매', assigneeNote: '박해랑 · 07.22' },
  { taskId: 'TSK-09-2', title: '비상 연락망 최종본 배포', assigneeNote: '정하늘 · 07.23' },
  { taskId: 'TSK-09-3', title: '안전 인력 배치안 확정', assigneeNote: '박해랑 · 07.24' },
]

export const MEETING_PARTICIPANTS: Record<string, DataRow[]> = {
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
      actionEnabled: true,
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
      actionEnabled: true,
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
      actionEnabled: true,
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
      actionEnabled: true,
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
      actionEnabled: true,
    },
  ],
}

// 회의를 만든 사람. 목록의 같은 사람과 값이 다르다 - 04B는 '권한 변경 및 회의
// 관리 가능'이라 적고 03A는 '시작·종료 가능'이라 적는다.
export const MEETING_FOLLOW_UPS: Record<string, DataRow[]> = {
  'MTG-04': [
    {
      taskId: 'TASK-04-1',
      title: '비상 연락망 최종본 배포',
      assigneeNote: '정하늘 · 07.23까지 · 위 결정사항에서 생성',
    },
  ],
}

export const MEETING_HOST_OWNER: Record<string, DataRow> = {
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
export const MEETING_DRAFT: Record<string, DataRow> = {
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

export const MEETING_CANDIDATES: DataRow[] = [
  { memberId: 'M-01', name: '박해랑', departmentNote: '운영부', alreadyAdded: true },
  { memberId: 'M-02', name: '정하늘', departmentNote: '운영부', alreadyAdded: true },
  { memberId: 'M-03', name: '이수현', departmentNote: '기획부', alreadyAdded: true },
  { memberId: 'M-04', name: '김민준', departmentNote: '재정부', alreadyAdded: true },
  { memberId: 'M-05', name: '이윤슬', departmentNote: '기획부' },
  { memberId: 'M-06', name: '김바다', departmentNote: '기획부' },
]

export const MEETING_DOCUMENTS: Record<string, DataRow[]> = {
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
