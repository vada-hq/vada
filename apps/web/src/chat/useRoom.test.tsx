// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { message, messagePage, room } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { useRoom } from './useRoom'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const base = '/api/organizations/c1/rooms/r1'

test('열어 둔 방의 다음 읽기에서 기존 메시지의 삭제를 반영하고 새 글과 만든 기록을 보존한다', async () => {
  const api = mockApi()
  const original = message('a1', '삭제 전 본문', {
    photos: [{ id: 'f1' }],
    made: [{ id: 'e1', kind: 'expense', title: '마커 값', blocking: true }],
  })
  const last = message('a2', '남길 글')
  let deleted = false
  api.on('GET', base, () => json({ room: room('r1'), participants: [] }))
  api.on('GET', `${base}/messages`, () =>
    json(
      messagePage(
        deleted
          ? [{ ...original, body: null, photos: [], deletedAt: '2026-10-28T00:00:00Z' }, last]
          : [original, last],
      ),
    ),
  )
  api.on('GET', `${base}/messages?after=a2`, () => json(messagePage([message('a3', '새 글')])))
  const { result } = renderHook(() => useRoom('c1', 'r1'))
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  deleted = true
  await act(async () => {
    await result.current.sync()
  })
  const state = result.current.state
  expect(state.kind).toBe('ready')
  if (state.kind !== 'ready') throw new Error('ready expected')
  expect(state.messages.map(item => item.id)).toEqual(['a1', 'a2', 'a3'])
  expect(state.messages[0]).toMatchObject({ body: null, photos: [], made: original.made })
})

test('읽어 둔 옛 쪽의 삭제도 거슬러 반영하고 늦은 응답으로 본문을 되살리지 않는다', async () => {
  const api = mockApi()
  const first = message('a1', '옛 글')
  let reads = 0
  let stale = false
  api.on('GET', base, () => json({ room: room('r1'), participants: [] }))
  api.on('GET', `${base}/messages`, () => {
    reads += 1
    return json(
      messagePage(reads === 1 ? [first, message('a2', '글 2')] : [message('a3', '글 3')], {
        hasOlder: reads > 1,
      }),
    )
  })
  api.on('GET', `${base}/messages?after=a2`, () => json(messagePage([message('a3', '글 3')])))
  api.on('GET', `${base}/messages?after=a3`, () => json(messagePage([])))
  api.on('GET', `${base}/messages?before=a3`, () =>
    json(
      messagePage([
        stale ? first : { ...first, body: null, photos: [], deletedAt: '2026-10-28T00:00:00Z' },
        message('a2', '글 2'),
      ]),
    ),
  )
  const { result } = renderHook(() => useRoom('c1', 'r1'))
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  await act(async () => {
    await result.current.sync()
  })
  expect(result.current.state.kind === 'ready' && result.current.state.messages[0]?.body).toBeNull()
  stale = true
  await act(async () => {
    await result.current.sync()
  })
  expect(result.current.state.kind === 'ready' && result.current.state.messages[0]?.body).toBeNull()
})

test('새 글이 20쪽을 넘어도 삭제 확인은 새 글을 붙이지 않고 다음 읽기에서 시간순으로 따라잡는다', async () => {
  const api = mockApi()
  const initial = [message('a1', '삭제 전 본문'), message('a2', '남길 글')]
  const messages = [
    ...initial,
    ...Array.from({ length: 1100 }, (_, index) => message(`new${index + 1}`, `새 글 ${index + 1}`)),
  ]
  const pageSize = 50
  let refreshing = false
  api.on('GET', base, () => json({ room: room('r1'), participants: [] }))
  for (let start = initial.length; start < messages.length; start += pageSize) {
    const page = messages.slice(start, start + pageSize)
    api.on('GET', `${base}/messages?after=${messages[start - 1]?.id}`, () =>
      json(messagePage(page, { hasNewer: start + pageSize < messages.length })),
    )
  }
  for (let end = messages.length; end > 0; end -= pageSize) {
    const start = Math.max(0, end - pageSize)
    const page = messages
      .slice(start, end)
      .map(item =>
        item.id === initial[0]?.id
          ? { ...item, body: null, deletedAt: '2026-10-28T00:00:00Z' }
          : item,
      )
    const path =
      end === messages.length ? `${base}/messages` : `${base}/messages?before=${messages[end]?.id}`
    api.on('GET', path, () =>
      json(messagePage(refreshing ? page : initial, { hasOlder: refreshing && start > 0 })),
    )
  }
  const { result } = renderHook(() => useRoom('c1', 'r1'))
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  refreshing = true
  await act(async () => {
    await result.current.sync()
  })
  const first = result.current.state
  if (first.kind !== 'ready') throw new Error('ready expected')
  const caughtUp = initial.length + pageSize * 20
  expect(first.messages.at(-1)?.id).toBe(messages[caughtUp - 1]?.id)
  expect(first.messages.map(item => item.id)).toEqual(
    messages.slice(0, caughtUp).map(item => item.id),
  )
  expect(first.messages[0]?.body).toBeNull()
  expect(api.calls.filter(call => call.path.includes('?after='))).toHaveLength(20)
  await act(async () => {
    await result.current.sync()
  })
  const second = result.current.state
  if (second.kind !== 'ready') throw new Error('ready expected')
  expect(second.messages.map(item => item.id)).toEqual(messages.map(item => item.id))
  expect(second.messages.at(-1)?.id).toBe(messages.at(-1)?.id)
  expect(second.messages[0]?.body).toBeNull()
  expect(api.calls.map(call => call.path)).toContain(
    `${base}/messages?after=${messages[caughtUp - 1]?.id}`,
  )
  api.assertNoUnexpectedRequests()
})
