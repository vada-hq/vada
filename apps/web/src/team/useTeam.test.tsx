// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { useTeam } from './useTeam'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('다시 읽은 운영진이 같으면 지금 값을 그대로 두고, 읽다 실패해도 보던 값을 둔다', async () => {
  const api = mockApi()
  let reply = () => json(teamResponse())
  api.on('GET', '/api/organizations/c1/members', () => reply())
  const { result } = renderHook(() => useTeam('c1', () => {}))
  await waitFor(() => expect(result.current.data).not.toBeNull())
  const first = result.current.data

  act(() => result.current.reload())
  await waitFor(() => expect(api.calls.length).toBe(2))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(result.current.data).toBe(first)

  reply = () => json({ code: 'INTERNAL' }, 500)
  act(() => result.current.reload())
  await waitFor(() => expect(api.calls.length).toBe(3))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(result.current.data).toBe(first)
})
