// 회장단 홈 ① '확인이 필요한 운영 상황'(f8, notes c1-final). 서버가 줄 갈래·차례·연락할 사람·셈을 정하고 화면은 그리기만 한다(DEC-38).

// 결재 대기를 '곧 필요'로 보는 기간: 필요한 때가 오늘(한국)부터 이 날수 안(지난 것 포함). 재정 결재 목록의 '임박'과 같은 값이다(DEC-92).
export const PURCHASE_NEEDED_SOON_DAYS = 3
// 화면이 처음에 그리는 줄 수(배정 줄 포함). 넘으면 '전체 n건 보기'로 홈 안에서 펼친다.
export const HOME_OPS_SHOWN = 5
// 서버가 보내는 일 줄 상한. 펼친 목록이 이만큼까지다(갈래별 수는 전체를 센다).
export const HOME_OPS_ROW_LIMIT = 50

// 일 줄의 갈래. 차례도 이 순서다(지남 → 오늘 마감 → 내일 마감 → 결재 대기).
export const HOME_OPS_KINDS = ['late', 'today', 'tomorrow', 'approval'] as const
export type HomeOpsKind = (typeof HOME_OPS_KINDS)[number]

// 연락하는 까닭: 부서 업무의 부장, 부서 없는 업무의 담당자, 결재의 재정 역할 부서 부장(부장 홈은 모든 줄이 담당자). 글은 화면이 만든다.
// title은 그 학생회가 정한 부서 직급 표시 이름이다(council.head_title).
export type HomeOpsRole =
  | { kind: 'head'; department: string; title: string }
  | { kind: 'assignee' }
  | { kind: 'finance_head'; department: string; title: string }
  // 회장단 업무의 담당자(③). title은 그 학생회가 정한 학생회 직급 표시 이름이다(회장·부회장).
  | { kind: 'council'; title: string }

export interface HomeOpsPerson {
  memberId: string
  name: string
  role: HomeOpsRole
  // 얼굴 색 번호(0~5): 지금 기수 운영진 가운데 들어온 차례를 6으로 나눈 나머지. 같은 사람은 어느 줄에서도 같다.
  tint: number
}

export interface HomeOpsRow {
  kind: HomeOpsKind
  target: { kind: 'task' | 'request'; id: string }
  title: string
  // late: 지난 날 수, today: 0, tomorrow: 1, approval: 필요한 때까지 남은 날 수(지났으면 음수)
  days: number
  event: { id: string; name: string } | null
  // 연락할 사람. 없으면(부장 없음, 부서 없는 업무의 담당자 없음) null이다.
  contact: HomeOpsPerson | null
  // 연락할 사람이 부장인데 그 부서에 지금 부장이 없으면 그 부서(부서 업무는 그 부서, 결재는 재정 역할 부서). 화면은 '부장 정하기'로 조직의 그 부서를 연다.
  noHead: { id: string; name: string } | null
  // 보는 사람이 이 줄에서 할 수 있는 것. 묻기는 아직 없어 늘 비어 있다.
  actions: 'ask'[]
}

export type HomeOpsAssign =
  // 회장단이 배정할 일. noDepartment는 업무 목록 '부서 없음 + 담당자 없음' 거르기의 수와 같다.
  | { by: 'council'; noDepartment: number; unassignedMembers: number; financeStaffed: boolean }
  // 부장이 배정할 일: 직급 부서의 끝나지 않은 업무 가운데 담당자 없는 것(업무 목록 '담당자 없음'과 같은 조건, 떠난 담당자 포함).
  // departments는 그 업무 목록을 열 때 거를 직급 부서다.
  | { by: 'head'; noAssignee: number; departments: { id: string; name: string }[] }

export interface HomeOps {
  // 일 줄을 갈래 차례로 HOME_OPS_ROW_LIMIT줄까지. 같은 갈래 안은 지남이 오래된 것부터, 결재는 필요한 때가 이른 것부터다.
  rows: HomeOpsRow[]
  // 갈래별 전체 수(접힌 줄 셈 '외 n건 · 결재 대기 1'에 쓴다)
  counts: Record<HomeOpsKind, number>
  // 배정할 일(맨 아래 한 줄). 회장단 홈과 부장 홈이 다르다.
  assign: HomeOpsAssign
  // 머리 건수 = 일 줄 전체 + 배정할 일(회장단: noDepartment + (미배정 구성원 있음 ? 1 : 0) + (재정 담당 없음 ? 1 : 0), 부장: noAssignee)
  total: number
}
