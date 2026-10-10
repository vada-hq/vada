import { useCallback, useEffect, useState } from 'react'
import type { FeeSettingsResponse, ReplaceDuesRosterRequest, SetFeeAccountRequest } from '@vada/contracts'
import { feeSettingsFailure, feeSettingsMessage } from './fee-view'

export type FeeResult = { ok: true } | { ok: false; message: string }
const isSettings = (body: unknown): body is FeeSettingsResponse => typeof body === 'object' && body !== null && 'account' in body
  && 'roster' in body && Array.isArray((body as FeeSettingsResponse).accountHistory)
const errorOf = (body: unknown) => (body as { error?: unknown } | null)?.error

// 참가비 설정(재정 전용): 학생회 계좌와 학생회비 납부 명단. 바꾸는 요청은 받은 응답으로 화면을 바꾸고, 실패하면 새로 불러온다.
export function useFeeSettings(organizationId: string, enabled: boolean) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}`
  const [data, setData] = useState<FeeSettingsResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(`${base}/fee-settings`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isSettings(body)) throw new Error('Fee settings lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  async function send(path: string, body: unknown): Promise<FeeResult> {
    try {
      const response = await fetch(`${base}${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (response.ok && isSettings(result)) {
        setData(result)
        return { ok: true }
      }
      refresh()
      return { ok: false, message: feeSettingsMessage(errorOf(result)) }
    } catch {
      return { ok: false, message: feeSettingsFailure }
    }
  }
  return {
    data, loadError, refresh,
    setAccount: (input: SetFeeAccountRequest) => send('/fee-account', input),
    replaceRoster: (input: ReplaceDuesRosterRequest) => send('/dues-roster', input),
    deleteRoster: (version: number) => send('/dues-roster/delete', { version }),
  }
}
export type FeeSettingsHook = ReturnType<typeof useFeeSettings>
