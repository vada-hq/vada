import { useCallback, useEffect, useState } from 'react'
import type { CreateRegistrationFormRequest, EventResponse, EventSummary, RegistrationResponse, UpdateEventRequest,
  UpdateRegistrationFormRequest } from '@vada/contracts'
import { registrationFailure, registrationMessage } from '../public/registration-text'
import { registrationBase } from './registration-view'

export type RegistrationResult = { ok: true } | { ok: false; message: string }
const isRegistration = (body: unknown): body is RegistrationResponse => typeof body === 'object' && body !== null && 'form' in body
  && Array.isArray((body as RegistrationResponse).registrations)
const errorOf = (body: unknown) => (body as { error?: unknown } | null)?.error

// 참가자 탭을 열 때 불러온다. 바꾸는 요청은 받은 응답으로 화면을 바꾸고, 실패하면 새로 불러온다.
export function useRegistration(organizationId: string, eventId: string, enabled: boolean) {
  const base = registrationBase(organizationId, eventId)
  const [data, setData] = useState<RegistrationResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(base, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isRegistration(body)) throw new Error('Registration lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  async function send(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<RegistrationResult> {
    try {
      const response = await fetch(`${base}${path}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (response.ok && isRegistration(result)) {
        setData(result)
        return { ok: true }
      }
      refresh()
      return { ok: false, message: registrationMessage(errorOf(result)) }
    } catch {
      return { ok: false, message: registrationFailure }
    }
  }
  return {
    data, loadError, refresh,
    create: (input: CreateRegistrationFormRequest) => send('POST', '', input),
    update: (input: UpdateRegistrationFormRequest) => send('PATCH', '', input),
    cancel: (registrationId: string) => send('POST', `/entries/${encodeURIComponent(registrationId)}/cancel`, {}),
  }
}
export type RegistrationHook = ReturnType<typeof useRegistration>

// 행사 일시·장소 수정. 남이 먼저 바꿨으면 code가 VERSION_CONFLICT다.
export async function updateEvent(organizationId: string, eventId: string, input: UpdateEventRequest):
  Promise<{ ok: true; event: EventSummary } | { ok: false; message: string; code: unknown }> {
  try {
    const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    const result: unknown = await response.json().catch(() => null)
    const event = (result as Partial<EventResponse> | null)?.event
    if (response.ok && typeof event === 'object' && event !== null) return { ok: true, event }
    return { ok: false, message: registrationMessage(errorOf(result)), code: errorOf(result) }
  } catch {
    return { ok: false, message: registrationFailure, code: null }
  }
}
