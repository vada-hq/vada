import { useState, type Dispatch, type SetStateAction } from 'react'
import type { BrowserSubscription, PushBrowser } from './push-client'
import { enableDevice } from './push-device'
import { unsupportedServiceOf, type PushTest } from './push-test'
import type { PushServer } from './usePushLoad'

type Options = {
  browser: PushBrowser
  server: PushServer
  setSubscription: Dispatch<SetStateAction<BrowserSubscription | null>>
  setEnableFailed: (failed: boolean) => void
  setTest: (test: PushTest) => void
}

// '알림 켜기'. 누른 동작 안에서 바로 구독하고(아이폰은 누른 동작 안에서만 허락을 묻는다), 허락 상태를 다시 읽는다.
export function usePushEnable({
  browser,
  server,
  setSubscription,
  setEnableFailed,
  setTest,
}: Options) {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    browser.supported ? browser.permission() : 'default',
  )

  // 열쇠가 바뀐 옛 구독은 대화상자를 열 때 이미 지웠으므로 여기서 기다릴 일이 없다.
  async function subscribe(ready: Extract<PushServer, { kind: 'ready' }>) {
    const result = await enableDevice(ready.manager, ready.key)
    setPermission(browser.permission())
    if (result.kind === 'on') setSubscription(result.subscription)
    else if (result.kind === 'unsupported-service') {
      setSubscription(null)
      setTest(unsupportedServiceOf(result.endpoint))
    } else {
      if (result.kind === 'save-failed') setSubscription(null)
      setEnableFailed(true)
    }
  }
  function enable() {
    if (server.kind !== 'ready') return
    setEnableFailed(false)
    setTest({ kind: 'idle' })
    void subscribe(server)
  }
  return { permission, enable }
}
