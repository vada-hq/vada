import { afterEach, expect, test, vi } from 'vitest'
import { updateAppBadge } from './app-badge'

afterEach(() => vi.unstubAllGlobals())

test('지원하면 안 읽은 수를 줄이지 않고 앱 배지에 보낸다', async () => {
  const setAppBadge = vi.fn(async (_count: number) => {})
  const clearAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { setAppBadge, clearAppBadge })
  await updateAppBadge(120)
  expect(setAppBadge).toHaveBeenCalledWith(120)
  expect(clearAppBadge).not.toHaveBeenCalled()
})

test('0이면 숫자 배지를 설정하지 않고 지운다', async () => {
  const setAppBadge = vi.fn(async (_count: number) => {})
  const clearAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { setAppBadge, clearAppBadge })
  await updateAppBadge(0)
  expect(clearAppBadge).toHaveBeenCalledOnce()
  expect(setAppBadge).not.toHaveBeenCalled()
})

test('배지를 지원하지 않으면 조용히 넘긴다', async () => {
  vi.stubGlobal('navigator', {})
  await expect(updateAppBadge(3)).resolves.toBeUndefined()
  await expect(updateAppBadge(0)).resolves.toBeUndefined()
})

test.each([0, 3])('배지 호출이 거부되거나 던져도 넘긴다(안 읽음 %i)', async count => {
  for (const operation of [
    vi.fn(async () => {
      throw new Error('denied')
    }),
    vi.fn(() => {
      throw new Error('unavailable')
    }),
  ]) {
    vi.stubGlobal('navigator', { setAppBadge: operation, clearAppBadge: operation })
    await expect(updateAppBadge(count)).resolves.toBeUndefined()
    expect(operation).toHaveBeenCalledOnce()
  }
})
