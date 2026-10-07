// 초대 링크 형식은 {origin}/join/{code}다. 코드가 맞는지는 서버가 판단한다.
const pattern = /^\/join\/([^/]+)$/

export function inviteCodeFromPath(pathname: string) {
  const segment = pattern.exec(pathname)?.[1]
  if (segment === undefined) return null
  try { return decodeURIComponent(segment) } catch { return segment }
}

export const invitePath = (code: string) => `/join/${encodeURIComponent(code)}`
