// 신청한 기기가 코드별 개인 링크 토큰을 기억한다. 같은 링크를 다시 열면 '이미 신청했어요'를 보이기 위해서다.
// 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 조용히 기억하지 않는다. 토큰은 주소에도 있다.
const PREFIX = 'vada.registration.'

function store(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function saveToken(code: string, token: string) {
  try {
    store()?.setItem(PREFIX + code, token)
  } catch {
    // 가득 찼거나 막혔다. 기억하지 못할 뿐 신청에는 영향이 없다.
  }
}

export function savedToken(code: string): string | null {
  try {
    return store()?.getItem(PREFIX + code) ?? null
  } catch {
    return null
  }
}

// 취소했거나 서버가 모르는 토큰이면 지운다. 코드를 모르므로 값으로 찾는다.
export function forgetToken(token: string) {
  const local = store()
  if (!local) return
  try {
    const keys = Array.from({ length: local.length }, (_, index) => local.key(index))
    for (const key of keys)
      if (key?.startsWith(PREFIX) && local.getItem(key) === token) local.removeItem(key)
  } catch {
    // 지우지 못해도 다음에 열 때 서버가 404로 답하고 다시 지운다.
  }
}
