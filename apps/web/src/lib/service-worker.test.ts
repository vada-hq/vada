// @vitest-environment jsdom
import { expect, test, vi } from 'vitest'
import { listenServiceWorker, PUSH_ARRIVED_EVENT, registerServiceWorker } from './service-worker'

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

function fakeContainer() {
  let listener: ((event: { data: unknown }) => void) | undefined
  return {
    addEventListener: vi.fn((_type: 'message', next: (event: { data: unknown }) => void) => {
      listener = next
    }),
    removeEventListener: vi.fn(),
    send: (data: unknown) => listener?.({ data }),
  }
}

test('서비스 워커가 알린 주소를 넘기고, 푸시가 왔다는 알림은 화면 전체에 알린다', () => {
  const container = fakeContainer()
  const onOpen = vi.fn()
  const arrived = vi.fn()
  window.addEventListener(PUSH_ARRIVED_EVENT, arrived)
  const stop = listenServiceWorker(onOpen, container)
  container.send({ type: 'vada:open', url: '/chat/c1/r1' })
  expect(onOpen).toHaveBeenCalledWith('/chat/c1/r1')
  container.send({ type: 'vada:push' })
  expect(arrived).toHaveBeenCalledTimes(1)
  stop()
  expect(container.removeEventListener).toHaveBeenCalled()
  window.removeEventListener(PUSH_ARRIVED_EVENT, arrived)
})

test('모르는 메시지나 주소가 글이 아닌 메시지는 무시한다', () => {
  const container = fakeContainer()
  const onOpen = vi.fn()
  listenServiceWorker(onOpen, container)
  for (const data of [null, 'x', 7, {}, { type: 'vada:open' }, { type: 'vada:open', url: 3 }])
    container.send(data)
  expect(onOpen).not.toHaveBeenCalled()
})

test('서비스 워커가 없으면 아무것도 하지 않는다', () => {
  expect(() => listenServiceWorker(vi.fn(), undefined)()).not.toThrow()
})
