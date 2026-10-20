import { useCallback, useState } from 'react'
import { sameKey } from './push-client'
import type { PushEnvironment } from './push-environment'
import type { PushProblem } from './push-load'
import { pushStateOf } from './push-state'
import { unsupportedServiceOf, type PushTest } from './push-test'
import { usePushEnable } from './usePushEnable'
import { usePushLoad } from './usePushLoad'
import { usePushTest } from './usePushTest'

export { currentEnvironment, type PushEnvironment } from './push-environment'
export type { PushTest } from './push-test'

// 휴대폰 알림 대화상자의 데이터. 열 때 서버 열쇠와 서비스 워커 등록을 미리 받아 두어,
// '알림 켜기'를 누른 동작 안에서 기다림 없이 구독한다(아이폰은 누른 동작 안에서만 허락을 묻는다).
export function usePush({ browser, device, homeScreenApp }: PushEnvironment) {
  const [enableFailed, setEnableFailed] = useState(false)
  const [test, setTest] = useState<PushTest>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const blocked = (device === 'ios' && !homeScreenApp) || !browser.supported
  const onProblem = useCallback((problem: PushProblem) => {
    if (problem.kind === 'unsupported-service') setTest(unsupportedServiceOf(problem.endpoint))
    else setEnableFailed(true)
  }, [])
  const { server, subscription, setSubscription } = usePushLoad({
    browser,
    blocked,
    attempt,
    onProblem,
  })
  const { permission, enable } = usePushEnable({
    browser,
    server,
    setSubscription,
    setEnableFailed,
    setTest,
  })
  const sendTest = usePushTest(subscription, () => setSubscription(null), setTest)

  const ready = server.kind === 'ready' ? server : null
  const state = pushStateOf({
    device,
    homeScreenApp,
    supported: browser.supported,
    server: server.kind,
    permission,
    subscribed: Boolean(subscription && ready && sameKey(subscription, ready.key)),
  })
  return {
    state,
    device,
    test,
    enableFailed,
    enable,
    sendTest,
    retry: () => setAttempt(value => value + 1),
  }
}
