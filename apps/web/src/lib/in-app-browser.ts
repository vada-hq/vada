// 구글은 앱에 내장된 브라우저에서의 로그인을 막는다(403 disallowed_useragent).
// 카카오톡은 기본 브라우저로 넘기는 주소를 제공하므로, 화면을 그리기 전에 넘긴다.
export const isKakaoInAppBrowser = (userAgent: string) => /KAKAOTALK/i.test(userAgent)

export function openOutsideKakao(userAgent: string, location: { href: string }) {
  if (!isKakaoInAppBrowser(userAgent)) return false
  location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`
  return true
}
