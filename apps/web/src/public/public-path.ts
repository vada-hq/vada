const MINE_PATH = '/r'

export type PublicRoute = { kind: 'apply'; code: string } | { kind: 'mine' }

// 로그인 없이 쓰는 화면의 주소. 아니면 null이라 앱이 보통 길(로그인)로 간다.
// 코드 모양이 틀려도 공개 화면이다(서버가 404로 가르고 화면이 '찾을 수 없어요'를 보인다).
export function publicRouteOf(pathname: string): PublicRoute | null {
  if (pathname === MINE_PATH || pathname === `${MINE_PATH}/`) return { kind: 'mine' }
  const match = /^\/apply\/([^/]+)\/?$/.exec(pathname)
  if (!match?.[1]) return null
  try {
    return { kind: 'apply', code: decodeURIComponent(match[1]).toUpperCase() }
  } catch {
    return { kind: 'apply', code: match[1] }
  }
}

// 개인 링크 주소. 토큰은 # 뒤에만 둔다(주소 줄과 접속 기록에 남지 않는다).
export const mineHref = (token: string) => `${MINE_PATH}#${token}`

export const tokenOfHash = (hash: string) => hash.replace(/^#/, '')
