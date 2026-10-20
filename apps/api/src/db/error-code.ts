// 오류에서 SQLSTATE나 시스템 오류 코드(ECONNREFUSED 등)처럼 대문자·숫자·밑줄로 된 코드만 꺼낸다. 없으면 빈 글자다.
// 오류 원문은 주소와 비밀번호를 담을 수 있어 쓰지 않는다. drizzle은 DB 오류를 감싸므로 cause를 세 단계까지 따라간다.
export const CAUSE_DEPTH_MAX = 3
export function errorCodeOf(error: unknown): string {
  let current = error
  for (let depth = 0; current && typeof current === 'object' && depth < CAUSE_DEPTH_MAX; depth++) {
    const code = 'code' in current ? String(current.code) : ''
    if (/^[A-Z0-9_]+$/.test(code)) return code
    current = 'cause' in current ? current.cause : undefined
  }
  return ''
}
