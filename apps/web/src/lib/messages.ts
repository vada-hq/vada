// 여러 화면이 같이 쓰는 안내 문구. 같은 사정에는 같은 말을 한다.

// 저장 요청이 실패했는데 표에 없는 이유일 때 쓰는 일반 문구.
export const SAVE_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'

// 서버가 403으로 답했다: 화면을 연 뒤에 내 권한이나 소속이 바뀌었다.
export const PERMISSION_CHANGED = '권한이 바뀌었어요. 화면을 새로 불러왔어요.'
// 로그인한 Google 계정의 이메일을 다른 계정이 이미 쓰고 있다(서버 EMAIL_IN_USE).
export const EMAIL_IN_USE =
  '이 Google 계정의 이메일을 다른 계정이 쓰고 있어요. 다른 계정으로 로그인해 주세요.'

// 화면마다 서버 오류 코드를 문구로 바꾸는 표. 표에 없는 코드는 그 화면의 일반 실패 문구로 보인다.
export const NOT_FOUND_RELOADED = '이미 바뀌었어요. 목록을 새로 불러왔어요.'

export const CREATE_COUNCIL_ERRORS: Record<string, string> = {
  COHORT_NOT_CURRENT: '임기에 오늘이 들어 있어야 해요. 기간을 확인해 주세요.',
  EMAIL_IN_USE,
}
export const CREATE_COUNCIL_FAILED = '학생회를 만들지 못했어요. 다시 시도해 주세요.'

export const JOIN_COUNCIL_ERRORS: Record<string, string> = {
  NO_CURRENT_COHORT: '지금 들어갈 수 있는 기수가 없어요. 학생회 회장단에게 알려 주세요.',
  EMAIL_IN_USE,
}
export const JOIN_COUNCIL_FAILED = '들어가지 못했어요. 연결을 확인하고 다시 시도해 주세요.'

export const COUNCIL_SETTINGS_ERRORS: Record<string, string> = {
  COHORT_NOT_CURRENT:
    '기간에 오늘이 들어 있어야 해요. 그렇지 않으면 모든 운영진이 학생회를 열 수 없어요.',
  FORBIDDEN: PERMISSION_CHANGED,
}

export const DEPARTMENT_ERRORS: Record<string, string> = {
  DEPARTMENT_NAME_TAKEN: '같은 이름의 부서가 있어요.',
  DEPARTMENT_IN_USE: '부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.',
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: NOT_FOUND_RELOADED,
}

export const PEOPLE_ERRORS: Record<string, string> = {
  PRESIDENT_CANNOT_LEAVE: '회장은 내보낼 수 없어요. 먼저 회장을 넘겨 주세요.',
  CANNOT_REMOVE_SELF: '나를 내보낼 수는 없어요.',
  PRESIDENT_REQUIRED: '회장의 직급은 회장 넘기기로만 바꿀 수 있어요.',
  ALREADY_PRESIDENT: '이미 회장이에요.',
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: NOT_FOUND_RELOADED,
}

export const INVITE_LOAD_ERRORS = {
  forbidden: PERMISSION_CHANGED,
  failed: '초대 링크를 불러오지 못했어요.',
}
