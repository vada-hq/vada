// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseSummary } from '@/test-support/purchase-fixtures'
import { usePendingCount } from './usePendingCount'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('결재 권한을 잃으면 이전에 읽은 수가 남아 있어도 배지 수를 내지 않는다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/purchase-requests?view=pending', () =>
    json({ requests: [purchaseSummary('a')], truncated: false }),
  )
  const { result, rerender } = renderHook(
    ({ enabled }) => usePendingCount('c1', () => {}, enabled),
    { initialProps: { enabled: true } },
  )
  await waitFor(() => expect(result.current.count?.label).toBe('1'))
  rerender({ enabled: false })
  expect(result.current.count).toBeNull()
  rerender({ enabled: true })
  expect(result.current.count?.label).toBe('1')
})
