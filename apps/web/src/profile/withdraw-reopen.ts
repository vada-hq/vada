// 탈퇴 전 다시 로그인은 Google로 넘어갔다가 앱을 처음부터 다시 연다. 돌아오면 확인 창을 다시 열도록 이 탭(sessionStorage)에 표시를 둔다.
// 로그인을 끝내지 않고 떠났으면 표시가 남으므로, 남긴 지 오래면 열지 않는다. 못 쓰는 브라우저에서는 다시 열지 않는다(탈퇴를 다시 누르면 된다).
const KEY = 'vada.withdrawAfterLogin'
// 10분: Google 로그인을 마치고 돌아오기에 넉넉하다.
const REOPEN_WITHIN_MS = 600_000

export function rememberReopen() {
  try {
    window.sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // 표시를 못 남겨도 로그인은 한다.
  }
}

export function forgetReopen() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // 읽지 못한 표시는 지울 것도 없다.
  }
}

// 읽기만 한다. 지우기는 그린 뒤(effect)에 해서, 개발 모드가 상태 초기값을 두 번 만들어도 같은 답이다.
export function wantsReopen(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(KEY))
    return at > 0 && Date.now() - at < REOPEN_WITHIN_MS
  } catch {
    return false
  }
}
