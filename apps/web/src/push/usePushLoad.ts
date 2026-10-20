import { useEffect, useState } from 'react'
import type { BrowserPushManager, BrowserSubscription, PushBrowser } from './push-client'
import { loadPush, type PushProblem } from './push-load'

export type PushServer =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'off' }
  | { kind: 'ready'; key: Uint8Array; manager: BrowserPushManager }

type Options = {
  browser: PushBrowser
  // 알림을 받을 수 없는 환경이면 서버를 부르지 않는다.
  blocked: boolean
  // 바뀌면 다시 읽는다('다시 시도').
  attempt: number
  // 이미 켜진 구독을 서버에 저장하지 못했을 때.
  onProblem: (problem: PushProblem) => void
}

// 열 때 서버 열쇠와 서비스 워커 등록을 미리 받아 두고, 이 기기의 구독을 확인한다.
export function usePushLoad({ browser, blocked, attempt, onProblem }: Options) {
  const [server, setServer] = useState<PushServer>({ kind: 'loading' })
  const [subscription, setSubscription] = useState<BrowserSubscription | null>(null)

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    setServer({ kind: 'loading' })
    void loadPush(browser, () => cancelled).then(result => {
      if (!result || cancelled) return
      if (result.kind !== 'ready') {
        setServer({ kind: result.kind })
        return
      }
      if (result.problem) onProblem(result.problem)
      setSubscription(result.subscription)
      setServer({ kind: 'ready', key: result.key, manager: result.manager })
    })
    return () => {
      cancelled = true
    }
  }, [blocked, browser, attempt, onProblem])

  return { server, subscription, setSubscription }
}
