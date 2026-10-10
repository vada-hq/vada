import { isKakaoInAppBrowser } from '@/lib/in-app-browser'

// 로그인 없이 쓰는 화면: 공개 참가 신청(/apply/코드)과 내 신청(/r#토큰). 코드가 맞는지는 서버가 판단한다.
export type PublicRoute = { kind: 'apply'; code: string } | { kind: 'mine' }
const decode = (segment: string) => { try { return decodeURIComponent(segment) } catch { return segment } }

export function publicRoute(pathname: string): PublicRoute | null {
  const code = /^\/apply\/([^/]+)$/.exec(pathname)?.[1]
  if (code !== undefined) return { kind: 'apply', code: decode(code) }
  return pathname === '/r' ? { kind: 'mine' } : null
}
export const applyPath = (code: string) => `/apply/${encodeURIComponent(code)}`
// 개인 링크 토큰은 # 뒤에 둔다. 브라우저가 서버로 보내지 않아 접속 기록에 남지 않는다.
export const minePath = (token: string) => `/r#${token}`
export const tokenFromHash = (hash: string) => hash.replace(/^#/, '') || null
// 공개 화면은 로그인이 없어 카카오톡 안에서도 그대로 연다. 앱 화면은 구글 로그인 때문에 기본 브라우저로 넘긴다.
export const shouldLeaveKakao = (route: PublicRoute | null, userAgent: string) => route === null && isKakaoInAppBrowser(userAgent)
