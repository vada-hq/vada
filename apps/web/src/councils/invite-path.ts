// 초대 링크 형식은 {origin}/join/{code}다. 코드가 맞는지는 서버가 판단한다(지금 vada와 같다).
const pattern = /^\/join\/([^/]+)$/
const decode = (segment: string) => { try { return decodeURIComponent(segment) } catch { return segment } }

export function inviteCodeFromPath(pathname: string) {
  const segment = pattern.exec(pathname)?.[1]
  return segment === undefined ? null : decode(segment)
}

// 받은 링크를 코드 칸에 통째로 붙여 넣어도 코드만 꺼낸다. https:// 없이 복사한 주소도 받는다.
export function inviteCodeFromText(text: string) {
  const segment = /\/join\/([^/?#\s]+)/.exec(text)?.[1]
  return segment === undefined ? text : decode(segment)
}

export const invitePath = (code: string) => `/join/${encodeURIComponent(code)}`
export const inviteLink = (code: string, origin = window.location.origin) => `${origin}${invitePath(code)}`
