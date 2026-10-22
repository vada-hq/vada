import { afterEach, expect, test, vi } from 'vitest'
import { json, mockApi } from '@/test-support/mock-api'
import { getJson, setTermsRequiredHandler } from './api'

afterEach(() => {
  setTermsRequiredHandler(null)
  vi.unstubAllGlobals()
})

test('403 TERMS_REQUIRED만 동의가 필요하다고 처리기에 알린다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1', () => json({ error: 'TERMS_REQUIRED' }, 403))
  api.on('GET', '/api/b', () => json({ error: 'FORBIDDEN' }, 403))
  const handler = vi.fn()
  setTermsRequiredHandler(handler)
  expect(await getJson('/api/b')).toEqual({ ok: false, status: 403, code: 'FORBIDDEN' })
  expect(handler).not.toHaveBeenCalled()
  expect(await getJson('/api/organizations/c1')).toEqual({
    ok: false,
    status: 403,
    code: 'TERMS_REQUIRED',
  })
  expect(handler).toHaveBeenCalledOnce()
})
