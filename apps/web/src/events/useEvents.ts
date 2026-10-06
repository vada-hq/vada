import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CreateEventSchema, type CreateEventRequest, type EventResponse, type EventSummary, type EventsResponse } from '@vada/contracts'
// 호출하는 화면을 organizationId로 key 처리해 소속 간 상태를 격리한다.
export function useEvents(organizationId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/events`
  const [events, setEvents] = useState<EventSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const pending = useRef(false)
  const active = useRef(false)

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    async function load() {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Event lookup failed')
        const body = await response.json() as EventsResponse
        if (!Array.isArray(body.events)) throw new Error('Invalid response')
        if (!controller.signal.aborted) setEvents(body.events)
      } catch {
        if (!controller.signal.aborted) setLoadError('행사 목록을 불러오지 못했어요. 로그인·소속 또는 서버 연결을 확인해 주세요.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [url, attempt])

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = CreateEventSchema.safeParse({ name })
    if (!parsed.success || pending.current || loading || loadError) return
    pending.current = true
    setSaving(true)
    setCreateError('')
    try {
      const body: CreateEventRequest = parsed.data
      const response = await fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Event creation failed')
      const result = await response.json() as EventResponse
      if (!result.event?.id || result.event.organizationId !== organizationId) throw new Error('Invalid response')
      if (active.current) {
        setEvents(previous => [result.event, ...(previous ?? [])])
        setName('')
      }
    } catch {
      // 응답 유실 시 서버에는 저장됐을 수 있으므로 자동으로 재전송하지 않는다.
      if (active.current) setCreateError('생성 결과를 확인하지 못했어요. 다시 만들기 전에 목록을 새로고침해 주세요.')
    } finally {
      pending.current = false
      if (active.current) setSaving(false)
    }
  }

  return { events, loading, loadError, name, setName, saving, createError, create,
    refresh: () => setAttempt(value => value + 1) }
}
