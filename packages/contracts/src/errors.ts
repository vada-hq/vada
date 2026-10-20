// 오류 코드와 HTTP 상태의 목록. 서버는 코드만 던지고 상태는 여기서 찾는다. 화면은 코드나 이 목록의 상태로 가른다.
// 코드는 응답의 error 값이라 이름을 바꾸면 화면과 외부가 깨진다. 새 오류는 여기에 더한다.
export const ERROR_STATUS = {
  INVALID_CURSOR: 400,
  INVALID_INPUT: 400,
  PUSH_SERVICE_UNSUPPORTED: 400,
  REASON_REQUIRED: 400,
  UPLOAD_MISMATCH: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ALREADY_PRESIDENT: 409,
  CANNOT_DIRECT_SELF: 409,
  CANNOT_REMOVE_SELF: 409,
  COHORT_NOT_CURRENT: 409,
  DEPARTMENT_IN_USE: 409,
  DEPARTMENT_NAME_TAKEN: 409,
  EMAIL_IN_USE: 409,
  NO_CURRENT_COHORT: 409,
  PHOTO_ALREADY_SENT: 409,
  PRESIDENT_CANNOT_LEAVE: 409,
  PRESIDENT_REQUIRED: 409,
  RECORD_CONFIRMED: 409,
  ROOM_READ_ONLY: 409,
  VERSION_CONFLICT: 409,
  BODY_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOO_MANY_REQUESTS: 429,
  DELIVERY_PROVIDER_FAILED: 502,
  STORAGE_NOT_CONFIGURED: 503,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS
export type ErrorStatus = (typeof ERROR_STATUS)[ErrorCode]

export const statusOf = (code: ErrorCode): ErrorStatus => ERROR_STATUS[code]

// 본문 없는 성공 응답. 서버가 보내고 화면이 알아본다.
export const NO_CONTENT = 204
// 이 번호부터는 서버 쪽 실패다. 화면은 이때 서버가 준 코드를 믿지 않고 'FAILED'로 본다.
export const SERVER_ERROR_FROM = 500
