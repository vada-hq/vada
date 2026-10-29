// 참가 신청(기능 007)의 안내 문구. 여러 화면이 같이 쓰는 문구는 messages.ts에 있다.
import { changeErrors } from './change-errors'
import { TASK_INVALID } from './messages'
import type { DepositStatus } from '@vada/contracts'

// 공개 참가 신청(기능 007): 로그인 없이 쓰는 화면이라 학생이 읽는 말이다.
export const REGISTRATION_LOST = '신청 정보를 찾을 수 없어요. 링크를 다시 확인해 주세요.'
export const REGISTRATION_FORM_LOST = '신청 양식을 찾을 수 없어요. 링크를 다시 확인해 주세요.'
export const REGISTRATION_LOAD_FAILED = '불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const APPLY_ERRORS: Record<string, string> = {
  REGISTRATION_NOT_OPEN: '지금은 신청을 받지 않아요. 화면을 새로 불러왔어요.',
  REGISTRATION_FULL: '정원이 다 찼어요. 화면을 새로 불러왔어요.',
  DUPLICATE_STUDENT_ID: '이 학번으로 이미 신청했어요',
  FORM_CHANGED: '신청 양식이 바뀌었어요. 새로 불러왔으니 확인하고 다시 신청해 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
  COMMAND_REUSED: '앞서 보내던 신청과 달라서 새로 준비했어요. 다시 신청해 주세요.',
  COMMAND_CONFLICT: '다른 요청과 겹쳤어요. 다시 신청해 주세요.',
}
export const APPLY_STUDENT_ID_INVALID = '학번은 숫자 6자리에서 12자리로 입력해 주세요'
export const APPLY_PHONE_INVALID = '휴대폰 번호를 확인해 주세요'
export const APPLY_FAILED = '신청하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const CANCEL_REGISTRATION_ERRORS: Record<string, string> = {
  CANCEL_CLOSED: '마감되어 스스로 취소할 수 없어요. 취소가 필요하면 운영진에게 알려 주세요.',
  CHECKED_IN: '이미 출석해서 취소할 수 없어요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
}
export const CANCEL_REGISTRATION_FAILED = '취소하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'

// 운영진의 참가 신청 화면(기능 007): 양식 만들기·고치기·멈추기, 신청자, 출석
// [입장 안 함]이 취소하려던 이번 찍기의 출석을 그사이 다른 운영진이 취소·재출석했다.
export const ATTENDANCE_CHANGED = '다른 운영진이 이미 바꿨어요.'
export const REGISTRATION_STAFF_ERRORS = changeErrors({
  FORM_NOT_READY: '링크 활성화 조건을 확인해 주세요.',
  FORM_HAS_APPLICANTS: '신청이 들어와 질문을 바꿀 수 없어요. 양식을 새로 불러와 확인해 주세요.',
  TASK_INVALID,
  FEE_ACCOUNT_REQUIRED: '참가비가 있으면 닫지 않은 계좌를 골라야 해요.',
  ACCOUNT_INVALID: '고를 수 없는 계좌예요. 닫았을 수 있어요. 다른 계좌를 골라 주세요.',
  CHECKED_IN: '이미 출석한 신청이에요. 출석을 먼저 취소해 주세요.',
  DEPOSIT_EXISTS: '이미 입금을 확인한 신청이에요. [새로 읽기]로 확인해 주세요.',
  NO_DEPOSIT: '확인한 입금이 없어요. [새로 읽기]로 확인해 주세요.',
  DEPOSIT_CLOSED: '이미 환불한 입금이라 확인을 취소할 수 없어요.',
  NOT_REFUNDABLE:
    '환불할 수 없는 신청이에요. 이미 환불했거나 취소하지 않은 신청이에요. [새로 읽기]로 확인해 주세요.',
  EVENT_COMPLETED: '완료한 행사라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 바꿀 수 있어요.',
  FORM_CLOSED:
    '마감한 양식이라 멈추거나 다시 받을 수 없어요. 마감 시각을 고치면 다시 받을 수 있어요.',
  NOT_CHECKED_IN: '출석 기록이 없어요. 화면을 새로 불러와 확인해 주세요.',
  ATTENDANCE_CHANGED,
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})

export const FORM_ACTIVATION_LABELS = {
  event_starts_at: '행사 시작 일시',
  closes_at: '신청 마감',
  registration_period: '신청 시작보다 늦은 마감',
  fee_account: '참가비 받을 계좌',
} as const
// 열어 둔 확인 창의 동작이 다시 읽은 줄에서 사라졌다.
export const REGISTRATION_ACTION_GONE =
  '지금은 할 수 없는 동작이라 닫았어요. 다른 운영진이 바꿨을 수 있어요.'
export const REGISTRATION_STAFF_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const REGISTRATION_STAFF_LOST =
  '신청 양식이나 신청을 찾을 수 없어요. 취소했거나 지웠을 수 있어요.'
export const REGISTRATION_FORMS_LOAD_FAILED = '신청 양식을 불러오지 못했어요. 연결을 확인해 주세요.'
export const FEE_ACCOUNTS_FAILED =
  '계좌 목록을 불러오지 못했어요. 이 창을 닫았다가 다시 열어 주세요.'
export const FEE_ACCOUNT_CLOSED = '고른 계좌를 닫았어요. 다른 계좌를 골라 주세요.'
export const APPLICANTS_LOAD_FAILED = '신청자를 불러오지 못했어요. 연결을 확인해 주세요.'
export const EVENT_APPLICANTS = {
  title: '행사 참가자',
  empty: '신청자 없음',
  noMatch: '맞는 참가자 없음',
  search: '이름이나 학번으로 찾기',
  searchHint: '이름·학번',
  searchInvalid: '검색어가 너무 길거나 사용할 수 없는 글자가 있어요.',
  quickFilters: '참가자 거르기',
  filter: '거르기',
  filterAll: '전체',
  registration: '신청',
  deposit: '입금',
  attendance: '참석',
  attention: '확인 필요',
  bulk: '일괄 처리',
  bulkDeposit: '입금 확인',
  bulkAttendance: '참석 처리',
  unselect: '선택 풀기',
  resultDone: '처리',
  resultFailed: '실패',
  applied: '신청',
  active: '신청함',
  cancelled: '취소함',
  attended: '참석',
  notAttended: '불참',
  noRecord: '참석 기록 없음',
  free: '무료',
  due: '받을 금액',
  name: '이름',
  studentId: '학번',
  phone: '휴대폰',
  fee: '참가비',
  affiliation: '소속',
  form: '양식',
  actions: '동작',
  selectPage: '현재 쪽 모두 선택',
  pages: '참가자 쪽 넘기기',
  previousPage: '이전 쪽',
  nextPage: '다음 쪽',
  reload: '새로 읽기',
  retry: '다시 시도',
  loading: '불러오는 중이에요',
  unknownApplicant: '신청자',
}
export const QUICK_FILTER_LABEL = {
  unpaid: '입금 안 함',
  attention: '확인 필요',
  attended: '참석',
  notAttended: '불참',
} as const
export const eventApplicantTotal = (count: number) => `총 ${count}명`
export const eventApplicantSelected = (count: number) => `${count}명 선택`
export const eventApplicantSelectAll = (count: number) => `${count}명 모두 선택`
export const eventApplicantCount = (kind: 'applicants' | 'attended', count: number) =>
  `${kind === 'applicants' ? EVENT_APPLICANTS.applied : EVENT_APPLICANTS.attended} ${count}명`
export const eventApplicantSelect = (name: string) => `${name} 선택`
export const eventApplicantActions = (name: string) => `${name} 동작`
export const clearApplicantFilter = (label: string) => `${label} 거르기 풀기`
export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  none: '입금 안 함',
  confirmed: '입금 확인',
  refund_pending: '환불 대기',
  refunded: '환불함',
}
export const bulkApplicantsSummary = (done: number, failed: number) =>
  `${done}명 처리, ${failed}명 실패`
export const applicantFailure = (code: string) => {
  if (code === 'NOT_FOUND') return REGISTRATION_STAFF_LOST
  if (code === 'FORBIDDEN') return '처리 권한이 없어요.'
  return REGISTRATION_STAFF_ERRORS[code] ?? REGISTRATION_STAFF_FAILED
}
