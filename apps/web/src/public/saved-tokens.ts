// 신청한 기기에 신청 링크별 개인 토큰을 둔다. 같은 링크를 다시 열면 내 신청으로 이어 준다.
// 개인 모드나 일부 웹뷰는 저장소를 막으므로, 실패하면 저장만 건너뛴다.
const key = (code: string) => `vada.registration.${code}`

export function savedToken(code: string) {
  try { return localStorage.getItem(key(code)) } catch { return null }
}
export function saveToken(code: string, token: string) {
  try { localStorage.setItem(key(code), token) } catch { /* 저장할 수 없는 브라우저 */ }
}
export function forgetToken(code: string) {
  try { localStorage.removeItem(key(code)) } catch { /* 저장할 수 없는 브라우저 */ }
}
// 찾을 수 없는 신청(취소·보관 기간 지남)의 토큰을 지운다. 신청 링크 코드는 모르므로 저장한 값으로 찾는다.
export function forgetTokenValue(token: string) {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    for (const name of keys) if (name?.startsWith(key('')) && localStorage.getItem(name) === token) localStorage.removeItem(name)
  } catch { /* 저장할 수 없는 브라우저 */ }
}
