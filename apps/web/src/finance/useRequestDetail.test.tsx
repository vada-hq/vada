// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { useRequestDetail } from './useRequestDetail'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('늦게 온 이전 읽기의 응답은 새 값을 덮지 않는다', async () => {
  const api = mockApi()
  const first = deferredResponse()
  const second = deferredResponse()
  const queue = [first, second]
  api.on('GET', '/api/organizations/c1/purchase-requests/r1', () => queue.shift()!.promise)
  const handlers = { onChanged: () => {}, onLost: () => {}, onForbidden: () => {} }
  const { result } = renderHook(() => useRequestDetail('c1', 'r1', handlers))
  await waitFor(() => expect(api.calls).toHaveLength(1))
  act(() => result.current.retry())
  await waitFor(() => expect(api.calls).toHaveLength(2))
  second.resolve(json({ request: purchaseDetail('r1', { title: '새 값' }) }))
  await waitFor(() => expect(result.current.request?.title).toBe('새 값'))
  first.resolve(json({ request: purchaseDetail('r1', { title: '옛 값' }) }))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(result.current.request?.title).toBe('새 값')
})
