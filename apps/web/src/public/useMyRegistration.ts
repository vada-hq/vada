import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type CancelRegistrationResponse, type MyRegistration } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CANCEL_REGISTRATION_ERRORS, CANCEL_REGISTRATION_FAILED } from '@/lib/messages'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { forgetToken } from './saved-links'

export type MineState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'lost' }
  | { kind: 'cancelled' }
  | { kind: 'ready'; data: MyRegistration }

// 개인 링크 토큰으로 내 신청을 읽고 취소한다. 토큰은 본문으로만 보낸다. 출석이 찍히면 보이는 동안 다시 읽어 QR이 '출석 확인됨'으로 바뀐다.
export function useMyRegistration(token: string) {
  const [state, setState] = useState<MineState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const load = useCallback(async () => {
    if (token === '') return setState({ kind: 'lost' })
    const result = await postJson<MyRegistration>('/api/public/registrations/lookup', { token })
    if (!alive.current) return
    if (result.ok) return setState({ kind: 'ready', data: result.data })
    if (result.status === statusOf('NOT_FOUND')) {
      forgetToken(token)
      return setState({ kind: 'lost' })
    }
    // 읽다 실패해도 보이던 신청은 그대로 둔다.
    setState(before => (before.kind === 'ready' ? before : { kind: 'failed' }))
  }, [token])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)

  const sending = useRef(false)
  async function cancel() {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setProblem('')
    const result = await postJson<CancelRegistrationResponse>('/api/public/registrations/cancel', {
      token,
    })
    sending.current = false
    if (!alive.current) return
    setBusy(false)
    if (result.ok) {
      forgetToken(token)
      return setState({ kind: 'cancelled' })
    }
    if (result.status === statusOf('NOT_FOUND')) return setState({ kind: 'lost' })
    setProblem(CANCEL_REGISTRATION_ERRORS[result.code] ?? CANCEL_REGISTRATION_FAILED)
    // 409는 마감이나 출석으로 사정이 달라졌다는 뜻이다. 취소 버튼이 지금도 맞는지 다시 읽는다.
    if (result.status === statusOf('CANCEL_CLOSED')) await load()
  }
  return { state, busy, problem, cancel, retry: () => void load() }
}
