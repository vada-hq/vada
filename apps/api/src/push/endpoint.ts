// 사용자가 준 주소로 서버가 요청을 보내므로 알려진 브라우저 알림 서버로만 보낸다(내부 주소를 찌르는 요청 위조 방지).
// 삼성 인터넷의 알림 서버는 확인하지 못했다. 실제 기기 확인에서 막히면 그 호스트를 여기에 더한다(휴대폰 길 spec).
const exactHosts = new Set(['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'])
const hostSuffixes = ['.notify.windows.com']

export function isKnownPushService(endpoint: string) {
  let url: URL
  try { url = new URL(endpoint) } catch { return false }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  const host = url.hostname
  return exactHosts.has(host) || hostSuffixes.some(suffix => host.endsWith(suffix) && host.length > suffix.length)
}
