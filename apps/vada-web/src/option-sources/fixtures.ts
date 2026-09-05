// 개발용 mock 데이터. 실제 데이터의 내용·id 규칙은 명세 번들에 없어 임시로 정했다
// (docs/pilot-onb01.md 마찰 로그 참조). 응답 형태는 option-sources.json 계약을 따른다.
import type { Option } from './catalog'

export const SCHOOLS: Option[] = [
  { value: 'sch-001', label: '바다대학교' },
  { value: 'sch-002', label: '한국해양대학교' },
  { value: 'sch-003', label: '부산바다대학교' },
  { value: 'sch-004', label: '서울과학기술대학교' },
  { value: 'sch-005', label: '바다시립대학교' },
]

export const COLLEGES: Record<string, Option[]> = {
  'sch-001': [
    { value: 'col-101', label: '해양과학대학' },
    { value: 'col-102', label: '공과대학' },
    { value: 'col-103', label: '인문사회대학' },
  ],
  'sch-002': [
    { value: 'col-201', label: '해사대학' },
    { value: 'col-202', label: '해양인문사회대학' },
  ],
  'sch-003': [
    { value: 'col-301', label: '자연과학대학' },
    { value: 'col-302', label: '경영대학' },
  ],
  'sch-004': [
    { value: 'col-401', label: '공과대학' },
    { value: 'col-402', label: '정보통신대학' },
  ],
  'sch-005': [{ value: 'col-501', label: '도시과학대학' }],
}

export const DEPARTMENTS: Record<string, Option[]> = {
  'sch-001:col-101': [
    { value: 'dep-1', label: '해양생명과학부' },
    { value: 'dep-2', label: '해양환경학과' },
  ],
  'sch-001:col-102': [
    { value: 'dep-3', label: '조선해양공학과' },
    { value: 'dep-4', label: '컴퓨터공학부' },
  ],
  'sch-001:col-103': [{ value: 'dep-5', label: '국어국문학과' }],
  'sch-002:col-201': [
    { value: 'dep-6', label: '항해융합학부' },
    { value: 'dep-7', label: '기관시스템공학부' },
  ],
  'sch-002:col-202': [{ value: 'dep-8', label: '해양행정학과' }],
  'sch-003:col-301': [{ value: 'dep-9', label: '수학과' }],
  'sch-003:col-302': [{ value: 'dep-10', label: '경영학부' }],
  'sch-004:col-401': [
    { value: 'dep-11', label: '기계시스템디자인공학과' },
    { value: 'dep-12', label: '신소재공학과' },
  ],
  'sch-004:col-402': [{ value: 'dep-13', label: '컴퓨터공학과' }],
  'sch-005:col-501': [{ value: 'dep-14', label: '도시행정학과' }],
}

// 행사 참가자를 거르는 선택지 넷. 디자인에는 빈 드롭다운으로만 있고, 무엇이 오는지는
// 그 행사에 실제로 신청한 사람과 조직이 정한 상태 목록이 정한다.
export const PARTICIPANT_AFFILIATIONS: Record<string, Option[]> = {
  'E-01': [
    { value: '컴퓨터학부', label: '컴퓨터학부' },
    { value: 'ICT융합학부', label: 'ICT융합학부' },
    { value: '인공지능학과', label: '인공지능학과' },
  ],
}

export const PARTICIPANT_APPLY_STATUS: Option[] = [
  { value: '신청 완료', label: '신청 완료' },
  { value: '대기 중', label: '대기 중' },
]

export const PARTICIPANT_PAY_STATUS: Option[] = [
  { value: '납부 확인', label: '납부 확인' },
  { value: '미납', label: '미납' },
  { value: '미확인', label: '미확인' },
]

export const PARTICIPANT_ATTEND_STATUS: Option[] = [
  { value: '참석', label: '참석' },
  { value: '불참', label: '불참' },
  { value: '미확인', label: '미확인' },
]

// 구매 요청이 고르는 것들. 디자인은 드롭다운을 전부 빈 네모로 그렸다 — 무엇이
// 오는지는 조직의 재정 규칙과 그 행사의 예산이 정한다.
// 값이 곧 사람이 읽는 말이다. 닫힌 말 목록 자체가 그 값이라, 코드를 따로 두면
// 화면이 그 코드를 무슨 말로 부를지 다시 물어야 한다(EVT-04의 상태 선택지와 같다).
// 예산 항목은 그 행사의 예산이라 행사마다 다르다.
export const BUDGET_ITEMS: Record<string, Option[]> = {
  'E-01': [
    { value: 'bi-01', label: '운영 물품비' },
    { value: 'bi-02', label: '홍보비' },
    { value: 'bi-03', label: '식음료비' },
    { value: 'bi-04', label: '대관·장비비' },
  ],
}

// 행사 운영 조직에 넣을 수 있는 사람(EVT-01·EVT-03B). **디자인이 펼친 목록을
// 그리지 않았으므로** 무엇이 오는지는 그 학생회의 명단이 정한다. 부서의 부원과
// 같은 id라야 고른 사람이 그 자리로 옮겨 간다.
const EVENT_STAFF_ROSTER: Option[] = [
  { value: 'ES-03', label: '김바다 · 컴퓨터학부 3학년' },
  { value: 'ES-04', label: '박해랑 · 컴퓨터학부 2학년' },
  { value: 'ES-05', label: '이윤슬 · ICT융합학부 4학년' },
  { value: 'ES-07', label: '정하늘 · 컴퓨터학부 3학년' },
]

export const EVENT_STAFF_CANDIDATES: Record<string, Option[]> = {
  'E-01': EVENT_STAFF_ROSTER,
  // 조직을 아직 세우지 않은 행사도 같은 학생회의 사람 중에서 고른다.
  'E-03': EVENT_STAFF_ROSTER,
}

// 메시지 방의 분류(MSG-02). **'일반'과 행사가 한 줄에 섞여 온다** — 행사는 조직이
// 만드는 것이라 명세가 목록을 들 수 없다. 값은 행사 id와 같아야 방이 어느 행사에
// 딸린 것인지가 이어진다.
export const MESSAGE_ROOM_CATEGORIES: Option[] = [
  // 그림이 '일반'을 골라진 채로 그렸다. 목록이 원격이라 명세가 그 값을 부를 수
  // 없으므로 **서버가 표시해서 온다**(options[].initiallySelected).
  { value: 'general', label: '일반', initiallySelected: true },
  { value: 'E-01', label: '2026 소프트웨어융합대학 체육대회' },
  { value: 'E-03', label: '2026 신입생 환영 행사' },
]

// 조직 전체 재정의 좁혀 보기(FIN-LEDGER-01). 달·행사·예산 항목은 조직이 언제부터
// 있었는지와 무엇을 벌였는지에 달렸으므로 명세가 목록을 들 수 없다.
export const LEDGER_MONTH_OPTIONS: Option[] = [
  { value: '2026-07', label: '2026년 7월' },
  { value: '2026-06', label: '2026년 6월' },
]

export const LEDGER_EVENT_OPTIONS: Option[] = [
  { value: 'E-01', label: '2026 체육대회' },
  { value: 'E-02', label: '신입생 환영 행사' },
  { value: 'E-03', label: '가을 축제' },
]

export const ORG_BUDGET_ITEM_OPTIONS: Option[] = [
  { value: 'BI-01', label: '안전·설비' },
  { value: 'BI-02', label: '인쇄·제작' },
  { value: 'BI-03', label: '회의·운영비' },
  { value: 'BI-04', label: '물품 구매' },
  { value: 'BI-05', label: '홍보비' },
  { value: 'BI-06', label: '사무·비품' },
]

// 학생회의 부서. 조직도(data-sources의 org.departments)와 **같은 목록이어야 한다** —
// 두 벌로 적으면 부서를 하나 만들 때 한쪽만 는다.
/** 예산을 배정할 행사(FIN-PLAN-01). 끝난 행사는 오지 않는다. */
export const BUDGET_EVENT_OPTIONS: Option[] = [
  { value: 'E-01', label: '2026 봄 축제', description: '기획 중' },
  { value: 'E-02', label: '2026 신입생 환영 행사', description: '진행 중' },
]

export const ORG_DEPARTMENT_OPTIONS: Option[] = [
  { value: 'D-01', label: '기획부' },
  { value: 'D-02', label: '홍보부' },
  { value: 'D-03', label: '디자인부' },
  { value: 'D-04', label: '운영부' },
  { value: 'D-05', label: '재정부' },
]

//

// 아카이브를 검토할 수 있는 사람(REC-02A). **디자인이 펼친 목록을 그리지 않았다** —
// 누가 검토할 수 있는지는 조직의 권한 규칙이라 명세가 목록을 들지 않는다.
export const ARCHIVE_REVIEWER_OPTIONS: Option[] = [
  { value: 'M-01', label: '김바다 · 회장단' },
  { value: 'M-02', label: '이윤슬 · 대외협력부장' },
]

// 참여 신청 폼이 고르는 것들(EXT-02A). **education.colleges·departments와 다른
// 물건이다** — 저쪽은 schoolId를 필수로 받는데 이 화면에는 학교 칸이 없다(그림에
// 없다). 어느 학교의 목록인지는 그 설문을 연 학생회가 이미 알고 있으므로 토큰이
// 곧 범위다.
export const SURVEY_COLLEGES: Record<string, Option[]> = {
  'SVY-4f2a91c7': [
    { value: 'col-sw', label: '소프트웨어융합대학' },
    { value: 'col-eng', label: '공학대학' },
    { value: 'col-sci', label: '과학기술융합대학' },
  ],
  'SVY-9c05b71d': [
    { value: 'col-sw', label: '소프트웨어융합대학' },
    { value: 'col-eng', label: '공학대학' },
  ],
}

export const SURVEY_DEPARTMENTS: Record<string, Option[]> = {
  'SVY-4f2a91c7:col-sw': [
    { value: 'dep-cs', label: '컴퓨터학부' },
    { value: 'dep-ict', label: 'ICT융합학부' },
    { value: 'dep-ai', label: '인공지능학과' },
  ],
  'SVY-4f2a91c7:col-eng': [
    { value: 'dep-me', label: '기계공학과' },
    { value: 'dep-ee', label: '전자공학부' },
  ],
  'SVY-4f2a91c7:col-sci': [{ value: 'dep-math', label: '수리데이터사이언스학과' }],
  'SVY-9c05b71d:col-sw': [
    { value: 'dep-cs', label: '컴퓨터학부' },
    { value: 'dep-ict', label: 'ICT융합학부' },
  ],
  'SVY-9c05b71d:col-eng': [{ value: 'dep-ee', label: '전자공학부' }],
}

// 회의록을 정리할 때 어느 안건을 열지 고르는 목록(OPS-MEET-06B).
//
// **곁에 붙는 말도 함께 온다.** 그림은 안건 이름 아래에 '확인 필요'를 그렸는데,
// 무엇이 남았는지는 그 안건의 정리 상태가 정하므로 화면이 셀 수 없다.
export const MEETING_AGENDA_PICKER: Record<string, Option[]> = {
  'MTG-09': [
    { value: 'AG-09-1', label: '안건 1', description: '확인 필요' },
    { value: 'AG-09-2', label: '안건 2', description: '확인 필요' },
    // 그림이 이 안건을 연 채로 그렸다. 셋 중 아직 결정이 없는 것이 이것이다 —
    // 어느 것인지는 그 회의의 정리 상태가 정하므로 서버가 표시해서 온다.
    { value: 'AG-09-3', label: '안건 3', description: '확인 필요', initiallySelected: true },
  ],
}
