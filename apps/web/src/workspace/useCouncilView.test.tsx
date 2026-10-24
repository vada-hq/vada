// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { useCouncilView } from './useCouncilView'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/organizations/c1'

test('다시 읽은 학생회가 같으면 지금 값을 그대로 두고, 다르면 바꾼다', async () => {
  const api = mockApi()
  let view = councilView('c1')
  api.on('GET', base, () => json(view))
  const { result } = renderHook(() => useCouncilView('c1'))
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  const first = result.current.state

  act(() => result.current.reload())
  await waitFor(() => expect(api.calls.length).toBe(2))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(result.current.state).toBe(first)

  view = councilView('c1', { name: '바뀐 이름' })
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.state).not.toBe(first))
})
