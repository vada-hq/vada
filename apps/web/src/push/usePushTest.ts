import { useRef } from 'react'
import type { BrowserSubscription } from './push-client'
import { sendPushTest, type PushTest } from './push-test'

// '시험 알림 보내기'. 보내는 중에는 다시 누른 것을 무시한다.
export function usePushTest(
  subscription: BrowserSubscription | null,
  forgetSubscription: () => void,
  setTest: (test: PushTest) => void,
) {
  const sending = useRef(false)
  return async function sendTest() {
    if (!subscription || sending.current) return
    sending.current = true
    setTest({ kind: 'sending' })
    try {
      const sent = await sendPushTest(subscription)
      if (sent.expired) forgetSubscription()
      setTest(sent.test)
    } finally {
      sending.current = false
    }
  }
}
