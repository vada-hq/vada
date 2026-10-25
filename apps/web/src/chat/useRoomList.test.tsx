// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { room, roomList } from '@/test-support/chat-fixtures'
import { chatBase } from '@/test-support/chat-harness'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { useRoomList } from './useRoomList'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('읽는 중에 다시 부르면 그 읽기가 끝난 뒤 새로 읽어, 읽기 뒤에 생긴 방도 받는다', async () => {
  const api = mockApi()
  const stale = deferredResponse()
  let reads = 0
  api.on('GET', `${chatBase}/rooms`, () => {
    reads += 1
    return reads === 1 ? stale.promise : json(roomList({ rooms: [room('r9')] }))
  })
  const { result } = renderHook(() => useRoomList('c1', () => {}, true))
  await waitFor(() => expect(reads).toBe(1))
  let outcome: Promise<boolean> | undefined
  act(() => {
    outcome = result.current.reload()
  })
  stale.resolve(json(roomList({ rooms: [room('r1')] })))
  await act(async () => {
    expect(await outcome).toBe(true)
  })
  expect(reads).toBe(2)
  expect(result.current.state.kind === 'ready' && result.current.state.data.rooms[0]?.id).toBe('r9')
})

test('다시 읽기가 실패하면 false를 돌려주고 보이던 목록은 그대로다', async () => {
  const api = mockApi()
  let fail = false
  api.on('GET', `${chatBase}/rooms`, () => (fail ? json({ error: 'x' }, 500) : json(roomList())))
  const { result } = renderHook(() => useRoomList('c1', () => {}, true))
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  fail = true
  await act(async () => {
    expect(await result.current.reload()).toBe(false)
  })
  expect(result.current.state.kind).toBe('ready')
})
