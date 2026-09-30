import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { CreateEventRequest, EventResponse, EventSummary, EventsResponse } from '@vada/contracts'
import Chat from '../chat/Chat'

type Props = { organizationId: string; handlesFinance?: boolean }
export default function Events(props: Props) {
  return <EventPanel key={props.organizationId} {...props} />
}

function EventPanel({ organizationId, handlesFinance = false }: Props) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/events`
  const inputId = useId()
  const [events, setEvents] = useState<EventSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [selected, setSelected] = useState<EventSummary | null>(null)
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
    const trimmed = name.trim()
    if (!trimmed || pending.current || loading || loadError) return
    pending.current = true
    setSaving(true)
    setCreateError('')
    try {
      const body: CreateEventRequest = { name: trimmed }
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

  if (selected) return <section className="events-panel" aria-label="행사">
    <button type="button" onClick={() => setSelected(null)}>행사 목록으로</button>
    <Chat organizationId={organizationId} eventId={selected.id} eventName={selected.name} handlesFinance={handlesFinance} />
  </section>

  return <section className="events-panel" aria-label="행사">
    <h3>행사</h3>
    {loading ? <p role="status">행사 목록 불러오는 중…</p> : loadError ? <p role="alert">{loadError}</p> : (
      events?.length ? <ul className="event-list">{events.map(event => <li key={event.id}><button type="button" onClick={() => setSelected(event)}>{event.name}</button></li>)}</ul> : <p>아직 행사가 없어요.</p>
    )}
    <button type="button" disabled={loading || saving} onClick={() => setAttempt(value => value + 1)}>목록 새로고침</button>
    <form aria-label="행사 만들기" onSubmit={e => { void create(e) }}>
      <label htmlFor={inputId}>행사 이름</label>
      <input id={inputId} value={name} required disabled={saving} onChange={e => setName(e.target.value)} />
      <button type="submit" disabled={!name.trim() || loading || Boolean(loadError) || saving}>{saving ? '만드는 중…' : '행사 만들기'}</button>
    </form>
    {createError && <p role="alert">{createError}</p>}
  </section>
}
