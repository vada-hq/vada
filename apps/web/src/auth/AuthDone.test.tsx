// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AuthDone from './AuthDone'
import { AUTH_CHANNEL } from './popup-login'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('로그인이 끝나면 본 창에 알리고 창을 닫는다', () => {
  const posted: [string, string][] = []
  vi.stubGlobal('BroadcastChannel', class {
    name: string
    constructor(name: string) { this.name = name }
    postMessage(message: string) { posted.push([this.name, message]) }
    close() {}
  })
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})
  render(<AuthDone failed={false} />)
  expect(posted).toEqual([[AUTH_CHANNEL, 'signed-in']])
  expect(close).toHaveBeenCalled()
  expect(screen.getByText('로그인했어요. 이 창을 닫아 주세요.')).toBeTruthy()
})

test('로그인이 실패하면 알리지 않고 안내만 한다', () => {
  const posted: string[] = []
  vi.stubGlobal('BroadcastChannel', class {
    postMessage(message: string) { posted.push(message) }
    close() {}
  })
  render(<AuthDone failed />)
  expect(posted).toEqual([])
  expect(screen.getByText('로그인이 완료되지 않았어요. 이 창을 닫고 다시 시도해 주세요.')).toBeTruthy()
})
