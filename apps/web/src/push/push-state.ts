import type { Device } from '@/lib/platform'

// 휴대폰 알림 대화상자가 보여 줄 상태(휴대폰 길 spec의 표). 위에서부터 먼저 맞는 것을 고른다.
export type PushState = 'needs-home-screen' | 'unsupported' | 'loading' | 'failed' | 'server-off' | 'denied' | 'on' | 'ask'
export type PushFacts = {
  device: Device
  homeScreenApp: boolean
  // 서비스 워커, PushManager, Notification이 모두 있다.
  supported: boolean
  server: 'loading' | 'failed' | 'off' | 'ready'
  permission: NotificationPermission
  // 구독이 있고 그 구독의 열쇠가 서버 열쇠와 같다.
  subscribed: boolean
}

export function pushStateOf(facts: PushFacts): PushState {
  if (facts.device === 'ios' && !facts.homeScreenApp) return 'needs-home-screen'
  if (!facts.supported) return 'unsupported'
  if (facts.server === 'off') return 'server-off'
  if (facts.server !== 'ready') return facts.server
  if (facts.permission === 'denied') return 'denied'
  return facts.permission === 'granted' && facts.subscribed ? 'on' : 'ask'
}
