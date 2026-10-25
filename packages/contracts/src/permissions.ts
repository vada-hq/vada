// 직급, 역할, 권한표의 동작 이름(DEC-16, DEC-28). 서버의 권한표(apps/api/src/access/permissions.ts)와 화면이 같이 쓴다.
// 직급의 표시 이름은 학생회가 정한다(council의 *_title 칸). 여기 값은 저장하는 이름이다.
export const COUNCIL_RANKS = ['president', 'vice_president'] as const
export type CouncilRank = (typeof COUNCIL_RANKS)[number]
export const DEPARTMENT_RANKS = ['head', 'vice_head'] as const
export type DepartmentRank = (typeof DEPARTMENT_RANKS)[number]
export const DEPARTMENT_ROLES = ['finance'] as const
export type DepartmentRole = (typeof DEPARTMENT_ROLES)[number]

// 바탕의 조직 칸(DEC-28, DEC-47). 다른 칸은 그 기능을 만드는 덩어리가 더한다(바탕 spec G9).
export const ACTIONS = [
  'council.view', // 학생회, 운영진, 부서 보기
  'council.update', // 학생회 정보와 직급 표시 이름 고치기
  'cohort.update', // 기수 고치기
  'department.manage', // 부서 만들기, 이름 바꾸기, 없애기, 재정 역할 주고 거두기
  'invite.manage', // 초대 코드 보기와 바꾸기
  'member.manage', // 운영진 내보내기, 부서 배정과 빼기
  'rank.manage', // 부회장 직급, 부장과 부부장 직급 주고 거두기
  'president.transfer', // 회장 직급 넘기기
  'chat.direct', // 1:1 대화 열기(모든 운영진)
  'chat.use', // 방 읽고 보내기. 그 방 참여자만이라 내 권한 목록에는 없다
  'task.manage', // 업무 만들기·고치기(그 부서 부장 기준과 담당자, 그 행사의 책임자)
  'task.delete', // 업무 지우기(그 부서 부장 기준, 그 행사의 책임자, 담당자이면서 만든 사람, DEC-73)
  'task.set_department', // 업무의 담당 부서 정하기(회장단, 그 행사의 책임자)
  'task.assign', // 업무 맡기기(그 부서 부장 기준, 그 행사의 책임자)
  'task.status', // 업무 상태 바꾸기(그 부서 부장 기준과 담당자, 그 행사의 책임자)
  'event.create', // 행사 만들기(회장단, 책임자도 정한다)
  'event.update', // 행사 고치기(회장단과 그 행사의 책임자, DEC-79)
  'event.complete', // 행사 완료와 완료 취소(회장단)
  'purchase.request', // 구매 요청 내기(모든 운영진)
  'purchase.cancel', // 구매 요청 취소(요청한 사람만)
  'purchase.approve', // 구매 품목 결재(재정부, 자기 요청 포함)
  'finance.manage', // 회계 기간, 예산 항목, 지출, 증빙, 취소, 환급(재정부)
  'registration.manage', // 신청 양식 만들기·고치기·멈추기, 신청 취소, 출석(그 행사의 책임자와 담당 부서, 회장단)
  'deposit.confirm', // 참가비 입금 확인과 확인 취소(그 행사의 책임자와 담당 부서, 회장단)
  'registration.view_applicants', // 신청자 이름·학번·휴대폰 보기(위에 재정부)
  'fee_payment.manage', // 학생회비 납부자 명단 올리기와 빼기(재정부)
  'fee_payment.view', // 학생회비 납부자 명단 보기(재정부와 회장단)
] as const
export type Action = (typeof ACTIONS)[number]
