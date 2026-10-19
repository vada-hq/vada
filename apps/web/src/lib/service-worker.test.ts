import { expect, test, vi } from 'vitest'
import { registerServiceWorker } from './service-worker'

test('서비스 워커를 맨 위 경로로 등록한다', () => {
  const register = vi.fn(async (_url: string) => ({}))
  registerServiceWorker({ register })
  expect(register).toHaveBeenCalledWith('/sw.js')
})

test('서비스 워커가 없거나 등록이 실패해도 화면을 막지 않는다', async () => {
  expect(() => registerServiceWorker(undefined)).not.toThrow()
  const register = vi.fn(async (_url: string) => {
    throw new Error('denied')
  })
  expect(() => registerServiceWorker({ register })).not.toThrow()
  await Promise.resolve()
  expect(register).toHaveBeenCalled()
})
