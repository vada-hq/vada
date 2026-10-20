// 여러 화면이 같이 쓰는 안내 문구. 같은 사정에는 같은 말을 한다.

// 저장 요청이 실패했는데 표에 없는 이유일 때 쓰는 일반 문구.
export const SAVE_FAILED = '저장하지 못했어요. 다시 시도해 주세요.'

// 서버가 403으로 답했다: 화면을 연 뒤에 내 권한이나 소속이 바뀌었다.
export const PERMISSION_CHANGED = '권한이 바뀌었어요. 화면을 새로 불러왔어요.'
// 로그인한 Google 계정의 이메일을 다른 계정이 이미 쓰고 있다(서버 EMAIL_IN_USE).
const EMAIL_IN_USE =
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

export const ROOM_LOST = '이 방을 볼 수 없어요'
export const ROOMS_LOAD_FAILED = '대화방을 불러오지 못했어요. 연결을 확인해 주세요.'
export const ROOM_LOAD_FAILED = '이 방을 불러오지 못했어요. 연결을 확인해 주세요.'
export const NOTICES_LOAD_FAILED = '공지를 불러오지 못했어요. 연결을 확인해 주세요.'
export const ROOM_SYNC_FAILED = '새 메시지를 불러오지 못하고 있어요. 연결을 확인해 주세요.'
export const OLDER_LOAD_FAILED = '이전 메시지를 불러오지 못했어요.'

// 공지 붙이기·떼기와 1:1 열기는 그 동작 옆에 오류를 보인다. 표에 없는 코드는 일반 문구다.
export const NOTICE_ERRORS: Record<string, string> = {
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: '이 메시지는 공지로 표시할 수 없어요.',
}
export const NOTICE_FAILED = '공지 표시를 바꾸지 못했어요. 다시 시도해 주세요.'
export const DIRECT_ERRORS: Record<string, string> = {
  CANNOT_DIRECT_SELF: '나와는 1:1 대화를 열 수 없어요.',
  FORBIDDEN: PERMISSION_CHANGED,
  NOT_FOUND: '이 운영진을 찾지 못했어요. 목록을 새로 불러왔어요.',
}
export const DIRECT_FAILED = '1:1 대화를 열지 못했어요. 다시 시도해 주세요.'
export const DIRECT_PEOPLE_FAILED = '운영진을 불러오지 못했어요. 연결을 확인해 주세요.'

// 메시지 보내기와 사진 올리기. 오류는 입력칸 옆에 보인다. 표에 없는 코드는 일반 문구다.
export const SEND_ERRORS: Record<string, string> = {
  TOO_MANY_REQUESTS: '너무 빨리 보내고 있어요. 잠시 뒤에 다시 보내 주세요.',
  ROOM_READ_ONLY: '이 방은 보기만 할 수 있어요.',
  INVALID_INPUT: '보낼 수 없는 내용이에요. 글과 사진을 확인해 주세요.',
  UPLOAD_MISMATCH: '올린 사진을 확인하지 못했어요. 그 사진을 빼고 다시 올려 주세요.',
  PHOTO_ALREADY_SENT: '이미 보낸 사진이에요. 그 사진을 빼고 보내 주세요.',
}
export const SEND_FAILED = '보내지 못했어요. 글과 사진은 그대로 있어요. 다시 보내 주세요.'
export const STORAGE_NOT_CONFIGURED =
  '지금은 사진을 보낼 수 없어요. 글은 보낼 수 있어요. 사진을 빼고 보내 주세요.'
export const PHOTO_CANNOT_OPEN = '이 사진을 열 수 없어요. 다른 사진을 골라 주세요.'
export const PHOTO_UPLOAD_FAILED = '사진을 올리지 못했어요. 연결을 확인하고 빼고 다시 올려 주세요.'
export const PHOTO_TOO_MANY = (max: number) => `사진은 한 번에 ${max}장까지 보낼 수 있어요.`
