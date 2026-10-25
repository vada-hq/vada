// 여러 화면이 같이 쓰는 안내 문구. 같은 사정에는 같은 말을 한다.
// 학생회를 바꾸는 화면의 오류 표는 changeErrors로 만들어 그만두는 학생회(COUNCIL_CLOSING)에 같은 말을 한다.
import { changeErrors } from './change-errors'

// 저장 요청이 실패했는데 표에 없는 이유일 때 쓰는 일반 문구.
export const SAVE_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'

// 서버가 403으로 답했다: 화면을 연 뒤에 내 권한이나 소속이 바뀌었다.
export const PERMISSION_CHANGED = '권한이 바뀌었어요. 화면을 새로 불러왔어요.'
// 로그인한 Google 계정의 이메일을 다른 계정이 이미 쓰고 있다(서버 EMAIL_IN_USE).
const EMAIL_IN_USE =
  '이 Google 계정의 이메일을 다른 계정이 쓰고 있어요. 다른 계정으로 로그인해 주세요.'
// 기수 고치기에서 임기 시작이 오늘 뒤다(서버 COHORT_NOT_STARTED, DEC-57). 학생회 만들기는 운영 연도로 기간을 채워 이 답이 없다.
const COHORT_NOT_STARTED = '임기 시작은 오늘이나 그 전이어야 해요.'

// 화면마다 서버 오류 코드를 문구로 바꾸는 표. 표에 없는 코드는 그 화면의 일반 실패 문구로 보인다.
export const NOT_FOUND_RELOADED = '이미 바뀌었어요. 목록을 새로 불러왔어요.'

// 업무에서 결과물을 만들 때 그 업무를 이을 수 없다(없어졌거나 끝났거나 취소됐거나 권한이 없다).
export const TASK_INVALID = '이 업무에는 결과물을 만들 수 없어요. 끝났거나 취소됐을 수 있어요.'

// 가입 동의 화면: 보여 준 뒤 약관이 바뀌었다(서버 TERMS_OUTDATED). 새 판을 다시 읽어 보인다.
export const AGREEMENT_ERRORS: Record<string, string> = {
  TERMS_OUTDATED: '약관이 바뀌었어요. 새 내용을 확인하고 다시 동의해 주세요.',
}
export const AGREEMENT_REQUIRED = '이용약관에 동의해 주세요'
export const AGREEMENT_READ_FAILED =
  '동의 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const AGREEMENT_FAILED = '동의를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'

export const INVITE_CODE_INVALID = '초대 코드를 확인해 주세요'

export const CREATE_COUNCIL_ERRORS: Record<string, string> = { EMAIL_IN_USE }
// 계약이 받지 않는 날짜(있을 수 없는 날, 받는 해 밖, 기수 밖). 길이 문제가 아니라서 칸 아래 글을 따로 준다.
export const DATE_CHECK = '날짜를 확인해 주세요'
export const CREATE_COUNCIL_FAILED = '학생회를 만들지 못했어요. 다시 시도해 주세요.'

export const JOIN_COUNCIL_ERRORS: Record<string, string> = {
  NO_CURRENT_COHORT: '지금 들어갈 수 있는 기수가 없어요. 학생회 회장단에게 알려 주세요.',
  EMAIL_IN_USE,
}
export const JOIN_COUNCIL_FAILED = '들어가지 못했어요. 연결을 확인하고 다시 시도해 주세요.'

export const COUNCIL_SETTINGS_ERRORS = changeErrors({
  COHORT_NOT_STARTED,
  // 기수 고치기에서 이미 시작한 다른 기수보다 임기 시작을 앞으로 옮겼다(서버 COHORT_NOT_LATEST).
  COHORT_NOT_LATEST: '임기 시작을 지난 기수보다 앞으로 옮길 수 없어요.',
  FORBIDDEN: PERMISSION_CHANGED,
})

// 조직 화면은 지금 사람이 있는 부서의 '없애기'에 서버에 묻지 않고 이 문구를 보인다.
export const DEPARTMENT_IN_USE = '부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.'

export const DEPARTMENT_ERRORS = changeErrors({
  DEPARTMENT_NAME_TAKEN: '같은 이름의 부서가 있어요.',
  DEPARTMENT_IN_USE,
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: NOT_FOUND_RELOADED,
})

export const PEOPLE_ERRORS = changeErrors({
  PRESIDENT_CANNOT_LEAVE: '회장은 내보낼 수 없어요. 먼저 회장을 넘겨 주세요.',
  CANNOT_REMOVE_SELF: '나를 내보낼 수는 없어요.',
  PRESIDENT_REQUIRED: '회장의 직급은 회장 넘기기로만 바꿀 수 있어요.',
  ALREADY_PRESIDENT: '이미 회장이에요.',
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: NOT_FOUND_RELOADED,
})

// 탈퇴 확인 창. 오류는 버튼 옆에 보인다. 표에 없는 코드는 일반 문구다(profile/useWithdrawal.ts).
export const WITHDRAW_ERRORS: Record<string, string> = {
  REAUTH_REQUIRED: '다시 로그인한 뒤 탈퇴할 수 있어요.',
  PRESIDENT_CANNOT_WITHDRAW: '회장 직급을 넘긴 뒤 탈퇴할 수 있어요.',
}

export const INVITE_LOAD_ERRORS = {
  forbidden: PERMISSION_CHANGED,
  failed: '초대 링크를 불러오지 못했어요.',
}
// 초대 링크 칸 아래 알림. 운영진 > 사람의 초대 링크 카드와 학생회 만들기의 초대 링크 단계가 같이 쓴다.
export const INVITE_NOTICES = {
  copied: { kind: 'notice', text: '초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.' },
  'copy-failed': { kind: 'error', text: '복사하지 못했어요. 링크를 직접 선택해 복사해 주세요.' },
  rotated: { kind: 'notice', text: '코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.' },
  failed: { kind: 'error', text: '코드를 바꾸지 못했어요. 다시 시도해 주세요.' },
  forbidden: { kind: 'error', text: PERMISSION_CHANGED },
} as const
export type InviteNotice = keyof typeof INVITE_NOTICES

// 주소가 가리키는 학생회나 화면이 없거나 내 것이 아닐 때. 있는지 없는지를 가르지 않는다.
export const ADDRESS_LOST = '찾을 수 없음'
export const ADDRESS_LOST_BACK = '홈으로'

// 저장하지 않은 입력이 있을 때 다른 곳으로 가려는 경우의 확인 창. 나가는 버튼은 늘 '닫기'(계속 쓰기)다.
export const LEAVE_TITLE = '입력을 버리고 나갈까요?'
export const LEAVE_CONFIRM = '입력 버리고 나가기'
export const ROOM_LOST = '이 방을 볼 수 없어요'
export const ROOMS_LOAD_FAILED = '대화방을 불러오지 못했어요. 연결을 확인해 주세요.'
export const ROOM_LOAD_FAILED = '이 방을 불러오지 못했어요. 연결을 확인해 주세요.'
export const ROOM_SYNC_FAILED = '새 메시지를 불러오지 못하고 있어요. 연결을 확인해 주세요.'
export const OLDER_LOAD_FAILED = '이전 메시지를 불러오지 못했어요.'

// 1:1 열기는 그 동작 옆에 오류를 보인다. 표에 없는 코드는 일반 문구다.
export const DIRECT_ERRORS = changeErrors({
  CANNOT_DIRECT_SELF: '나와는 1:1 대화를 열 수 없어요.',
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: '이 운영진을 찾지 못했어요. 목록을 새로 불러왔어요.',
})
export const DIRECT_FAILED = '1:1 대화를 열지 못했어요. 다시 시도해 주세요.'
export const DIRECT_PEOPLE_FAILED = '운영진을 불러오지 못했어요. 연결을 확인해 주세요.'

// 행사(목록, 상세, 만들기, 고치기). 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const EVENT_ERRORS = changeErrors({
  TASK_INVALID,
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const EVENT_FAILED = '저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const EVENTS_LOAD_FAILED = '행사를 불러오지 못했어요. 연결을 확인해 주세요.'
export const EVENT_LOAD_FAILED = '행사를 불러오지 못했어요. 연결을 확인해 주세요.'
export const EVENT_LOST = '이 행사를 볼 수 없어요. 다른 학생회의 행사일 수 있어요.'
// 행사의 돈 탭: 정산 읽기와 완료·완료 취소. 오류는 그 동작 옆에 보인다.
export const SETTLEMENT_LOAD_FAILED = '정산을 불러오지 못했어요. 연결을 확인해 주세요.'
// 결산을 공개한 기간에는 합계를 바꾸는 쓰기를 막는다(기능 009 조각 4가 서버에서 낸다). 수입과 지출이 같이 쓴다.
const PERIOD_CLOSED =
  '결산을 공개한 기간이라 바꿀 수 없어요. 재정부가 결산을 다시 열면 바꿀 수 있어요.'

export const COMPLETION_ERRORS = changeErrors({
  SETTLEMENT_PENDING: '아직 정산이 끝나지 않았어요. 남은 것을 처리한 뒤에 완료해 주세요.',
  EVENT_NOT_ENDED: '끝난 뒤에 완료할 수 있어요.',
  PERIOD_CLOSED,
  NO_FISCAL_PERIOD:
    '참가비를 수입으로 넣을 회계 기간이 없어요. 재정의 예산 탭에서 회계 기간을 먼저 만들어 주세요.',
  EVENT_COMPLETED: '이미 완료한 행사예요. 새로 불러왔어요.',
  EVENT_NOT_COMPLETED: '완료한 행사가 아니에요. 새로 불러왔어요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const COMPLETION_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
// 행사 머리의 상태 행동 자리에 버튼 대신 두는 막힌 까닭(서버 blockers). 요약 줄 한 칸이라 명사형 한 줄이고, 거절 뒤의 문구는 위 COMPLETION_ERRORS다.
export const COMPLETION_BLOCKED: Record<string, string> = {
  SETTLEMENT_PENDING: '정산 남은 것 있음',
  NO_FISCAL_PERIOD: '참가비를 넣을 회계 기간 없음',
  PERIOD_CLOSED: '결산 공개한 기간',
}
export const EVENT_COMPLETED_NOTICE = '완료한 행사라 바꿀 수 없어요.'

// 업무와 지출을 만들거나 고칠 때 고른 행사가 이 학생회의 것이 아닐 때
const EVENT_INVALID = '이 학생회의 행사가 아니에요. 다른 행사를 골라 주세요.'

// 업무 상세와 만들기. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const TASK_ERRORS = changeErrors({
  EVENT_INVALID,
  TASK_ASSIGNEE_INVALID:
    '이 학생회의 지금 운영진만 담당자가 될 수 있어요. 다른 사람을 골라 주세요.',
  TASK_DEPARTMENT_INVALID: '이 학생회의 부서가 아니에요. 다른 부서를 골라 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
// 담당자 되돌리기에서 이전 담당자가 그 사이 운영진이 아니게 되었을 때
export const UNDO_ASSIGNEE_INVALID =
  '이전 담당자가 지금은 운영진이 아니에요. 다른 사람을 골라 주세요.'
export const TASK_FAILED = '저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const TASK_LOAD_FAILED = '업무를 불러오지 못했어요. 연결을 확인해 주세요.'
export const TASK_LOST = '이 업무를 볼 수 없어요. 지워졌을 수 있어요.'
export const TASK_OPTIONS_FAILED =
  '업무를 만들 수 있는 부서와 담당자를 불러오지 못했어요. 연결을 확인해 주세요.'
export const TASK_OPTIONS_LOADING = '부서와 담당자를 불러오는 중이에요. 잠시 뒤에 다시 눌러 주세요.'
export const TASK_TEAM_FAILED = '운영진과 부서를 불러오지 못했어요. 연결을 확인해 주세요.'

// 메시지 보내기와 사진 올리기. 오류는 입력칸 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const SEND_ERRORS = changeErrors({
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 보내 주세요.',
  ROOM_READ_ONLY: '이 방은 보기만 할 수 있어요.',
  TASK_INVALID,
  INVALID_INPUT: '보낼 수 없는 내용이에요. 글과 사진을 확인해 주세요.',
  UPLOAD_MISMATCH: '올린 사진을 확인하지 못했어요. 그 사진을 빼고 다시 올려 주세요.',
  STORAGE_NOT_CONFIGURED:
    '지금은 사진을 보낼 수 없어요. 글은 보낼 수 있어요. 사진을 빼고 보내 주세요.',
  PHOTO_ALREADY_SENT: '이미 보낸 사진이에요. 그 사진을 빼고 보내 주세요.',
})
export const SEND_FAILED = '보내지 못했어요. 글과 사진은 그대로 있어요. 다시 보내 주세요.'
export const PHOTO_TOO_BIG = '사진이 너무 커요. 다른 사진을 골라 주세요.'
export const PHOTO_CANNOT_OPEN = '이 사진을 열 수 없어요. 다른 사진을 골라 주세요.'
export const PHOTO_UPLOAD_FAILED = '사진을 올리지 못했어요. 연결을 확인하고 빼고 다시 올려 주세요.'
export const PHOTO_TOO_MANY = (max: number) => `사진은 한 번에 ${max}장까지 보낼 수 있어요.`

// 홈(운영진의 첫 화면).
export const HOME_LOAD_FAILED = '홈을 불러오지 못했어요. 연결을 확인해 주세요.'

// 업무 목록과 카드. 상태 바꾸기 오류는 그 카드 안에 보인다. 표에 없는 코드는 일반 문구다.
export const TASKS_LOAD_FAILED = '업무를 불러오지 못했어요. 연결을 확인해 주세요.'
export const TASK_STATUS_ERRORS = changeErrors({
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: '이 업무는 지워졌어요. 목록을 새로 불러왔어요.',
  TOO_MANY_REQUESTS: '너무 빨리 바꾸고 있어요. 잠시 뒤에 다시 해 주세요.',
})
export const TASK_STATUS_FAILED = '상태를 바꾸지 못했어요. 다시 시도해 주세요.'

// 알림이 꺼져 있다는 띠의 문구. 화면이 무엇을 놓칠 수 있는지에 맞춘다.
export const PUSH_OFF_CHAT = '휴대폰 알림이 꺼져 있어요. 새 글과 부름을 놓칠 수 있어요.'
export const TASK_PUSH_OFF = '휴대폰 알림이 꺼져 있어요. 맡은 업무를 놓칠 수 있어요.'
export const FINANCE_PUSH_OFF = '휴대폰 알림이 꺼져 있어요. 새 요청과 결재 결과를 놓칠 수 있어요.'

// 구매 요청 목록, 내기, 상세, 취소. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const PURCHASES_LOAD_FAILED = '구매 요청을 불러오지 못했어요. 연결을 확인해 주세요.'
export const PURCHASE_LOAD_FAILED = '이 요청을 불러오지 못했어요. 연결을 확인해 주세요.'
export const PURCHASE_LOST = '이 요청을 볼 수 없어요. 다른 학생회의 요청이거나 없어졌을 수 있어요.'
export const PURCHASE_ERRORS = changeErrors({
  REQUEST_CLOSED: '이미 결재가 시작됐거나 취소된 요청이라 취소할 수 없어요. 새로 불러왔어요.',
  EVENT_INVALID: '이 학생회의 행사가 아니에요. 다른 행사를 골라 주세요.',
  LINE_ITEM_DECIDED: '이미 결재된 품목이 있어요. 요청을 새로 불러왔으니 확인해 주세요.',
  LINE_ITEM_NOT_CANCELLABLE: '취소할 수 없는 품목이에요. 요청을 새로 불러왔으니 확인해 주세요.',
  BUDGET_ITEM_INVALID: '이 예산 항목은 지금 쓸 수 없어요. 항목을 다시 골라 주세요.',
  NO_FISCAL_PERIOD: '지금 회계 기간이 없어요. 예산 탭에서 먼저 만들어 주세요.',
  EVENT_COMPLETED:
    '완료한 행사의 요청이라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 바꿀 수 있어요.',
  MEMBER_INVALID: '요청한 사람이 지금 운영진이 아니에요. 다른 사람을 골라 주세요.',
  TASK_INVALID,
  MESSAGE_INVALID:
    '이 메시지를 더는 볼 수 없어 요청을 낼 수 없어요. 방에서 나갔는지 확인해 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const PURCHASE_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
// 결재는 취소와 같은 코드를 쓰지만 문구가 다르다.
export const DECIDE_ERRORS = changeErrors({
  ...PURCHASE_ERRORS,
  REQUEST_CLOSED: '취소된 요청이라 결재할 수 없어요. 새로 불러왔어요.',
  EVENT_MISMATCH: '요청과 다른 행사의 예산 항목이에요. 다른 항목을 골라 주세요.',
})

// 예산 탭: 회계 기간 만들기와 예산 항목 더하기. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const BUDGET_LOAD_FAILED = '예산을 불러오지 못했어요. 연결을 확인해 주세요.'
export const BUDGET_LOST = '예산을 볼 수 없어요. 학생회를 새로 불러왔어요.'
export const BUDGET_ERRORS = changeErrors({
  FISCAL_PERIOD_CONFLICT:
    '기간이 겹치거나 같은 이름의 회계 기간이 있어요. 이름과 날짜를 확인해 주세요.',
  NO_FISCAL_PERIOD: '지금 회계 기간이 없어요. 먼저 회계 기간을 만들어 주세요.',
  EVENT_COMPLETED: '완료한 행사라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 할 수 있어요.',
  EVENT_INVALID: '이 학생회의 행사가 아니에요. 다른 행사를 골라 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const BUDGET_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'

// 계좌 탭: 더하기, 고치기, 닫기. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const ACCOUNTS_LOAD_FAILED = '계좌를 불러오지 못했어요. 연결을 확인해 주세요.'
export const ACCOUNT_LOST = '이 계좌를 볼 수 없어요. 계좌를 새로 불러왔어요.'
export const ACCOUNT_ERRORS = changeErrors({
  MAIN_ACCOUNT_EXISTS:
    '대표 계좌가 이미 있어요. 그 계좌를 먼저 사업용으로 바꾸거나 닫은 뒤에 정해 주세요.',
  ACCOUNT_NAME_TAKEN: '같은 이름의 계좌가 있어요. 다른 이름을 적어 주세요.',
  ACCOUNT_CLOSED: '이미 닫은 계좌예요. 계좌를 새로 불러왔어요.',
  ACCOUNT_IN_USE: '신청 양식이 쓰는 계좌예요. 계좌를 새로 불러왔어요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const ACCOUNT_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'

// 납부자 명단 탭: 올리기와 빼기. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const FEE_PAYMENTS_LOAD_FAILED = '납부자 명단을 불러오지 못했어요. 연결을 확인해 주세요.'
export const FEE_PAYMENT_SEARCH_INVALID = '학번은 숫자로, 너무 길지 않게 써 주세요.'
export const FEE_PAYMENT_LOST = '이 학번은 이미 비워졌어요. 명단을 새로 불러왔어요.'
export const FEE_PAYMENT_ERRORS = changeErrors({
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT:
    '올릴 수 없는 내용이에요. 학번이 비었거나 한 번에 올릴 수 있는 수를 넘었는지 확인해 주세요.',
  BODY_TOO_LARGE: '한 번에 올리기에는 너무 많아요. 나누어서 올려 주세요.',
})
export const FEE_PAYMENT_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'
export const EXPENSE_ACCOUNTS_FAILED =
  '계좌 목록을 불러오지 못했어요. 계좌 없이 적을 수 있어요. 계좌를 정하려면 이 창을 닫았다가 다시 열어 주세요.'
export const EXPENSE_ACCOUNT_CLOSED =
  '고른 계좌를 닫았어요. 다른 계좌를 고르거나 없음으로 적어 주세요.'

// 지출 목록, 적기, 상세, 취소·환급, 증빙 사진. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const EXPENSES_LOAD_FAILED = '지출을 불러오지 못했어요. 연결을 확인해 주세요.'
export const EXPENSE_LOAD_FAILED = '이 지출을 불러오지 못했어요. 연결을 확인해 주세요.'
export const EXPENSE_LOST = '이 지출을 볼 수 없어요. 다른 학생회의 지출이거나 없어졌을 수 있어요.'
export const EXPENSE_OPTIONS_FAILED = '고를 목록을 불러오지 못했어요. 연결을 확인해 주세요.'
export const EXPENSE_ERRORS = changeErrors({
  LINE_ITEM_NOT_PAYABLE:
    '결제할 수 없는 품목이 있어요. 승인되지 않았거나 취소된 요청이에요. 품목을 다시 골라 주세요.',
  MEMBER_INVALID: '먼저 낸 사람이나 부탁한 사람이 지금 운영진이 아니에요. 다른 사람을 골라 주세요.',
  EXPENSE_CANCELLED: '이미 취소된 지출이에요. 새로 불러왔어요.',
  NOT_REIMBURSABLE:
    '환급할 수 없는 지출이에요. 먼저 낸 사람이 없거나 이미 환급했어요. 새로 불러왔어요.',
  MESSAGE_INVALID:
    '이 사진은 붙일 수 없어요. 볼 수 없는 대화의 사진이에요. 목록을 새로 불러왔어요. 다른 사진을 골라 주세요.',
  EVIDENCE_LIMIT: '증빙 사진은 한 지출에 20장까지 붙일 수 있어요.',
  UPLOAD_MISMATCH: '올린 사진을 확인하지 못했어요. 그 사진을 빼고 다시 올려 주세요.',
  PHOTO_ALREADY_SENT: '이미 붙인 사진이에요. 그 사진을 빼고 다시 올려 주세요.',
  STORAGE_NOT_CONFIGURED:
    '지금은 사진을 올릴 수 없어요. 지출은 적을 수 있어요. 나중에 다시 해 주세요.',
  BUDGET_ITEM_INVALID: '고를 수 없는 예산 항목이에요. 다른 항목을 골라 주세요.',
  EVENT_COMPLETED:
    '완료한 행사의 지출이라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 바꿀 수 있어요.',
  PERIOD_CLOSED,
  EVENT_MISMATCH: '결제한 요청의 행사와 달라요. 요청과 같은 행사를 골라 주세요.',
  EVENT_INVALID,
  ACCOUNT_INVALID: '고를 수 없는 계좌예요. 닫았을 수 있어요. 다른 계좌를 골라 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
// 지출 적기의 409 MESSAGE_INVALID는 근거 메시지 이야기라 사진 고르기·붙이기와 문구가 다르다.
export const EXPENSE_CREATE_ERRORS = changeErrors({
  ...EXPENSE_ERRORS,
  MESSAGE_INVALID:
    '이 메시지를 근거로 할 수 없어요. 볼 수 없는 대화의 메시지예요. 닫고 대화에서 다시 열어 주세요.',
  COMMAND_REUSED: '앞서 보내던 지출과 달라서 새로 준비했어요. 다시 적어 주세요.',
  COMMAND_CONFLICT: '다른 요청과 겹쳤어요. 다시 적어 주세요.',
})

// 대화 사진을 증빙으로 붙일 때(사진 고르기, 메시지의 사진). 올린 파일이 아니라 대화의 사진이라 다시 올리라고 하지 않는다.
export const CHAT_EVIDENCE_ERRORS = changeErrors({
  ...EXPENSE_ERRORS,
  UPLOAD_MISMATCH: '이 사진은 증빙으로 붙일 수 없는 파일이에요. 다른 사진을 골라 주세요.',
})
export const ACTION_GONE = '지금은 할 수 없는 동작이에요. 화면을 새로 불러왔어요.'
export const EXPENSE_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const CHAT_PHOTOS_FAILED = '대화 사진을 불러오지 못했어요. 연결을 확인해 주세요.'
export const EVIDENCE_UPLOAD_FAILED =
  '사진을 올리지 못했어요. 연결을 확인하고 빼고 다시 올려 주세요.'

// 수입 탭: 목록, 적기, 상세, 취소. 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const INCOMES_LOAD_FAILED = '수입을 불러오지 못했어요. 연결을 확인해 주세요.'
export const INCOME_LOAD_FAILED = '이 수입을 불러오지 못했어요. 연결을 확인해 주세요.'
export const INCOME_LOST = '이 수입을 볼 수 없어요. 다른 학생회의 수입이거나 없어졌을 수 있어요.'
export const PERIODS_LOAD_FAILED = '회계 기간을 불러오지 못했어요. 연결을 확인해 주세요.'
export const INCOME_ITEMS_FAILED = '예산 항목을 불러오지 못했어요. 항목 없이 적을 수 있어요.'
export const INCOME_ERRORS = changeErrors({
  NO_FISCAL_PERIOD:
    '받은 날이 든 회계 기간이 없어요. 날짜를 확인하거나 예산 탭에서 기간을 먼저 만들어 주세요.',
  PERIOD_CLOSED,
  EVENT_COMPLETED:
    '완료한 행사의 예산 항목이라 바꿀 수 없어요. 회장단이 완료를 취소하면 다시 바꿀 수 있어요.',
  BUDGET_ITEM_INVALID: '고를 수 없는 예산 항목이에요. 다른 항목을 골라 주세요.',
  ACCOUNT_INVALID: '고를 수 없는 계좌예요. 닫았을 수 있어요. 다른 계좌를 골라 주세요.',
  INCOME_CANCELLED: '이미 취소된 수입이에요. 새로 불러왔어요.',
  INCOME_AUTOMATIC:
    '참가비와 이월금 수입은 직접 취소할 수 없어요. 행사 완료를 취소하거나 결산을 다시 열면 바뀌어요. 새로 불러왔어요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const INCOME_PERIOD_NOT_STARTED =
  '이 기간은 아직 시작하지 않아 받은 날을 고를 수 없어요. 시작한 뒤에 적어 주세요.'
export const INCOME_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'

// 결산 탭: 읽기, 공개, 다시 열기, 내보내기(기능 009). 오류는 그 동작 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const CLOSING_LOAD_FAILED = '결산서를 불러오지 못했어요. 연결을 확인해 주세요.'
export const CLOSING_LOST = '이 기간을 볼 수 없어요. 다른 학생회의 기간이거나 없어졌을 수 있어요.'
export const CLOSING_HIDDEN = '결산이 공개되면 보여요.'
// 재정 개요 탭: 지금 기간의 결산서를 읽어 예산과 쓴 돈을 보인다.
export const OVERVIEW_LOAD_FAILED = '재정 개요를 불러오지 못했어요. 연결을 확인해 주세요.'
export const CLOSING_ERRORS = changeErrors({
  PERIOD_NOT_ENDED: '아직 끝나지 않은 기간이에요. 기간이 끝난 다음 날부터 공개할 수 있어요.',
  PREVIOUS_PERIOD_OPEN: '앞 기간의 결산이 아직 공개되지 않았어요. 앞 기간부터 공개해 주세요.',
  CLOSING_NEGATIVE: '남은 돈이 0원보다 적어서 공개할 수 없어요. 수입과 지출을 확인해 주세요.',
  FEE_INCOME_PENDING:
    '완료하지 않은 행사의 참가비가 아직 수입에 없어요. 그 행사를 완료한 뒤 공개해 주세요.',
  CLOSING_PUBLISHED: '이미 공개한 결산이에요. 새로 불러왔어요.',
  CLOSING_NOT_PUBLISHED: '공개하지 않은 결산이에요. 새로 불러왔어요.',
  NEXT_PERIOD_CLOSED:
    '다음 기간의 결산이 공개되어 있어서 다시 열 수 없어요. 다음 기간을 먼저 다시 열어 주세요.',
  EXPORT_TOO_LARGE: '내보낼 내용이 너무 많아요. 이 기간은 VADA 팀에 부탁해 주세요.',
  STORAGE_NOT_CONFIGURED: '지금은 증빙 묶음을 만들 수 없어요. 나중에 다시 해 주세요.',
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 입력을 확인해 주세요.',
})
export const CLOSING_FAILED = '보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
export const CLOSING_EXPORT_FAILED = '파일을 받지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
