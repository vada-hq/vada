// 휴대폰 길에서 기기마다 안내를 달리할 곳을 가린다. 사용자 에이전트로만 정한다.
export type Device = 'ios' | 'android' | 'other'

export function deviceOf(userAgent: string, maxTouchPoints = 0): Device {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  // iPadOS 사파리는 맥으로 자신을 알린다. 터치가 되는 맥은 아이패드다.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'other'
}

// iOS 홈 화면 앱에서만 참이다. 사파리 탭에서는 false이고, 다른 기기에는 이 값이 없다.
export const isIosHomeScreenApp = (navigator: { standalone?: boolean }) => navigator.standalone === true
