// 사용자가 준 주소로 서버가 요청을 보내므로 알려진 브라우저 알림 서버로만 보낸다(내부 주소를 찌르는 요청 위조 방지).
// 삼성 인터넷의 알림 서버는 확인하지 못했다. 실제 기기 확인에서 막히면 그 호스트를 여기에 더한다(휴대폰 길 spec).
const exactHosts = new Set([
  'fcm.googleapis.com',
  'web.push.apple.com',
  'updates.push.services.mozilla.com',
])
const hostSuffixes = ['.notify.windows.com']

export function isKnownPushService(endpoint: string) {
  // 검사와 실제 연결에 쓰는 URL 파서가 다르지 않도록, 호스트 부분을 엄격히 제한한다(web-push의 url.parse와 WHATWG 일치).
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::443)?(?:[\/?#]|$)/.test(endpoint)) return false
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  const host = url.hostname
  return (
    exactHosts.has(host) ||
    hostSuffixes.some(suffix => host.endsWith(suffix) && host.length > suffix.length)
  )
}
