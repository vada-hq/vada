import { useEffect, useRef, useState } from 'react'
import { CreateMessageSchema, type CreateMessageRequest, type MessageResponse, type MessageSummary, type MessagesResponse } from '@vada/contracts'

class RequestError extends Error {
  constructor(readonly status: number) { super('Chat request failed') }
}

export function useChat(organizationId: string, eventId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/messages`
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const rows = useRef<MessageSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const blocked = useRef(false)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [draft, setDraft] = useState('')
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  // nextCursor의 최신 값. 이전 페이지를 이어 불러오는 비동기 반복에서 쓴다.
  const cursor = useRef<string | null>(null)
  function moveCursor(next: string | null) {
    cursor.current = next
    setNextCursor(next)
  }

  function update(next: MessageSummary[]) {
    rows.current = next
    setMessages(next)
  }
  function fail(error: unknown) {
    if (error instanceof RequestError && [401, 403, 404].includes(error.status)) {
      blocked.current = true
      setDenied(true)
      update([])
      moveCursor(null)
      setSendError('')
      setLoadError('대화방에 접근할 수 없어요. 로그인·소속을 확인해 주세요.')
    } else {
      setLoadError('대화를 불러오지 못했어요. 다시 불러오기를 눌러 주세요.')
    }
  }
  async function page(signal: AbortSignal, before?: string): Promise<MessagesResponse> {
    const response = await fetch(before ? `${url}?before=${encodeURIComponent(before)}` : url, {
      credentials: 'same-origin', cache: 'no-store', signal,
    })
    if (!response.ok) throw new RequestError(response.status)
    const body = await response.json() as MessagesResponse
    if (!Array.isArray(body.messages) || !(body.nextCursor === null || typeof body.nextCursor === 'string')) throw new Error('Invalid response')
    return body
  }
  async function latest(signal: AbortSignal) {
    let result = await page(signal)
    let incoming = result.messages
    const known = new Set(rows.current.map(message => message.id))
    // 최신 페이지와 기존 대화 사이에 간격이 있으면 이전 페이지를 이어 받아 메운다.
    const cursors = new Set<string>()
    while (known.size && !incoming.some(message => known.has(message.id)) && result.nextCursor && !signal.aborted) {
      if (cursors.has(result.nextCursor)) throw new Error('Repeated cursor')
      cursors.add(result.nextCursor)
      result = await page(signal, result.nextCursor)
      incoming = [...result.messages, ...incoming]
    }
    if (signal.aborted) return
    const incomingIds = new Set(incoming.map(message => message.id))
    if (!known.size) moveCursor(result.nextCursor)
    update([...rows.current.filter(message => !incomingIds.has(message.id)), ...incoming])
    blocked.current = false
    setDenied(false)
    setLoadError('')
  }
  async function run(signal: AbortSignal, action: () => Promise<void>) {
    if (lock.current || signal.aborted) return
    lock.current = true
    setBusy(true)
    try { await action() } catch (error) { if (!signal.aborted) fail(error) } finally {
      if (!signal.aborted) {
        lock.current = false
        setBusy(false)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const current = new AbortController()
    controller.current = current
    lock.current = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      if (!blocked.current && document.visibilityState !== 'hidden') await run(current.signal, () => latest(current.signal))
      if (!current.signal.aborted) timer = setTimeout(() => { void poll() }, 3000)
    }
    void poll()
    return () => { current.abort(); clearTimeout(timer) }
  }, [url])

  function refresh() {
    const signal = controller.current?.signal
    if (signal) void run(signal, () => latest(signal))
  }
  function older() {
    const signal = controller.current?.signal
    if (!signal || !nextCursor || blocked.current) return
    void run(signal, async () => {
      const result = await page(signal, nextCursor)
      if (signal.aborted) return
      const known = new Set(rows.current.map(message => message.id))
      update([...result.messages.filter(message => !known.has(message.id)), ...rows.current])
      moveCursor(result.nextCursor)
      setLoadError('')
    })
  }
  function send() {
    const signal = controller.current?.signal
    const parsed = CreateMessageSchema.safeParse({ content: draft })
    if (!signal || loading || blocked.current || loadError || !parsed.success) return
    void run(signal, async () => {
      setSendError('')
      try {
        const body: CreateMessageRequest = parsed.data
        const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!response.ok) throw new RequestError(response.status)
        const result = await response.json() as MessageResponse
        if (!result.message?.id) throw new Error('Invalid response')
        if (signal.aborted) return
        setDraft(current => current === draft ? '' : current)
      } catch (error) {
        if (signal.aborted) return
        if (error instanceof RequestError && [401, 403, 404].includes(error.status)) { fail(error); return }
        // 응답이 유실돼도 저장됐을 수 있으므로 자동 재전송하지 않는다.
        setSendError('전송 결과를 확인하지 못했어요. 다시 보내기 전에 대화를 다시 불러와 확인해 주세요.')
        return
      }
      await latest(signal)
    })
  }
  // 후보에서 고른 메시지를 찾는다. 다른 불러오기가 끝나기를 기다린 뒤 이전 페이지를 10번까지 더 불러온다.
  async function reveal(messageId: string) {
    const signal = controller.current?.signal
    const has = () => rows.current.some(message => message.id === messageId)
    const idle = async () => { for (let wait = 0; lock.current && wait < 50; wait++) await new Promise(resolve => setTimeout(resolve, 100)) }
    await idle()
    for (let pages = 0; !has() && pages < 10 && cursor.current && signal && !signal.aborted && !blocked.current; pages++) {
      await idle()
      const before = cursor.current
      await run(signal, async () => {
        const result = await page(signal, before)
        if (signal.aborted) return
        const known = new Set(rows.current.map(message => message.id))
        update([...result.messages.filter(message => !known.has(message.id)), ...rows.current])
        moveCursor(result.nextCursor)
        setLoadError('')
      })
      if (cursor.current === before) break
    }
    return has()
  }
  return { messages, nextCursor, loading, busy, denied, loadError, sendError, draft, setDraft, refresh, older, send, reveal }
}
