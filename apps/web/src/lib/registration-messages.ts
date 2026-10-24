// 참가 신청(기능 007)의 안내 문구. 여러 화면이 같이 쓰는 문구는 messages.ts에 있다.

// 공개 참가 신청(기능 007): 로그인 없이 쓰는 화면이라 학생이 읽는 말이다.
export const REGISTRATION_LOST = '신청 정보를 찾을 수 없어요. 링크를 다시 확인해 주세요.'
export const REGISTRATION_FORM_LOST = '신청 양식을 찾을 수 없어요. 링크를 다시 확인해 주세요.'
export const REGISTRATION_LOAD_FAILED = '불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const APPLY_ERRORS: Record<string, string> = {
  REGISTRATION_NOT_OPEN: '지금은 신청을 받지 않아요. 화면을 새로 불러왔어요.',
  REGISTRATION_FULL: '정원이 다 찼어요. 화면을 새로 불러왔어요.',
  FORM_CHANGED: '신청 양식이 바뀌었어요. 새로 불러왔으니 확인하고 다시 신청해 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
}
export const APPLY_FAILED = '신청하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const CANCEL_REGISTRATION_ERRORS: Record<string, string> = {
  CANCEL_CLOSED: '마감되어 스스로 취소할 수 없어요. 취소가 필요하면 운영진에게 알려 주세요.',
  CHECKED_IN: '이미 출석해서 취소할 수 없어요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
}
export const CANCEL_REGISTRATION_FAILED = '취소하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'

// 운영진의 참가 신청 화면(기능 007): 양식 만들기·고치기·멈추기, 신청자, 출석
export const REGISTRATION_STAFF_ERRORS: Record<string, string> = {
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
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
}
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
