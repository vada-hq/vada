// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { layerDirectRecord, leave, navigate } from './app-location'

const C = '0199d1a0-0000-7000-8000-0000000000c1'
const R = '0199d1a0-0000-7000-8000-0000000000d1'
const where = () => window.location.pathname + window.location.search

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(() => vi.restoreAllMocks())

test('알려진 주소는 읽기가 돌려주는 한 가지 꼴로 쓴다', () => {
  navigate(`/TASKS/${C}`)
  expect(where()).toBe(`/TASKS/${C}`)
  navigate(`/tasks/${C.toUpperCase()}?view=mine&x=1#top`)
  expect(where()).toBe(`/tasks/${C}`)
})

test('replace는 칸을 쌓지 않는다', () => {
  const push = vi.spyOn(window.history, 'pushState')
  navigate(`/home/${C}`, { replace: true })
  expect(push).not.toHaveBeenCalled()
  expect(where()).toBe(`/home/${C}`)
})

test('앱 안에서 쌓은 칸이면 화면 안 뒤로는 한 칸 뒤로, 링크로 바로 들어왔으면 상위 목록으로 바꿔 쓴다', () => {
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  window.history.replaceState(null, '', `/tasks/${C}/${R}`)
  leave(`/tasks/${C}`)
  expect(back).not.toHaveBeenCalled()
  expect(where()).toBe(`/tasks/${C}`)
  navigate(`/tasks/${C}/${R}`)
  leave(`/tasks/${C}`)
  expect(back).toHaveBeenCalledTimes(1)
})

test('링크로 바로 들어온 기록 주소는 상위 목록 칸 위에 쌓고, 이미 쌓은 칸은 다시 쌓지 않는다', () => {
  const push = vi.spyOn(window.history, 'pushState')
  window.history.replaceState(null, '', `/purchases/${C}/${R}`)
  layerDirectRecord()
  expect(push).toHaveBeenCalledTimes(1)
  expect(where()).toBe(`/purchases/${C}/${R}`)
  layerDirectRecord()
  expect(push).toHaveBeenCalledTimes(1)
  window.history.back()
})
