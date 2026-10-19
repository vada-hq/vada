import { expect, test, vi } from 'vitest'
import { finishPopupLogin, startPopupLogin } from './popup-login'

const popupOf = () => ({ location: { href: 'about:blank' }, close: vi.fn() })

test('누른 순간 앱 안 창을 먼저 열고, 받은 Google 주소로 그 창을 보낸다', async () => {
  const order: string[] = []
  const popup = popupOf()
  const result = await startPopupLogin(
    () => {
      order.push('open')
      return popup
    },
    async () => {
      order.push('sign-in')
      return { data: { url: 'https://accounts.google.com/o/oauth2/auth?x=1' }, error: null }
    },
  )
  expect(order).toEqual(['open', 'sign-in'])
  expect(result).toBe('opened')
  expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/auth?x=1')
})

test('창이 막히면 로그인을 시작하지 않는다', async () => {
  const signIn = vi.fn(async () => ({ data: { url: 'https://accounts.google.com/' }, error: null }))
  expect(await startPopupLogin(() => null, signIn)).toBe('blocked')
  expect(signIn).not.toHaveBeenCalled()
})

test('Google 주소를 받지 못하면 연 창을 닫는다', async () => {
  for (const signIn of [
    async () => ({ data: null, error: { status: 500 } }),
    async () => ({ data: {}, error: null }),
    async () => {
      throw new Error('network')
    },
  ]) {
    const popup = popupOf()
    expect(await startPopupLogin(() => popup, signIn)).toBe('failed')
    expect(popup.close).toHaveBeenCalled()
  }
})

test('로그인이 끝난 창은 본 창에 알리고 닫는다', () => {
  const channel = { postMessage: vi.fn(), close: vi.fn() }
  const closeWindow = vi.fn()
  finishPopupLogin(channel, closeWindow)
  expect(channel.postMessage).toHaveBeenCalledWith('signed-in')
  expect(channel.close).toHaveBeenCalled()
  expect(closeWindow).toHaveBeenCalled()
  expect(() => finishPopupLogin(null, closeWindow)).not.toThrow()
})
