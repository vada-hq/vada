// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { layerDirectRecord, leave, navigate, pageState, savePageState } from './app-location'
import { ADOPT_KEY } from './use-window-history'

const C = '0199d1a0-0000-7000-8000-0000000000c1'
const R = '0199d1a0-0000-7000-8000-0000000000d1'
const where = () => window.location.pathname + window.location.search

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(() => vi.restoreAllMocks())

test('알려진 주소는 읽기가 돌려주는 한 가지 꼴로 쓴다', () => {
  navigate(`/TASKS/${C}`)
  expect(where()).toBe(`/TASKS/${C}`)
  navigate(`/tasks/${C.toUpperCase()}?view=mine&x=1#top`)
  expect(where()).toBe(`/tasks/${C}?view=mine`)
})

test('replace는 칸을 쌓지 않는다', () => {
  const push = vi.spyOn(window.history, 'pushState')
  navigate(`/home/${C}`, { replace: true })
  expect(push).not.toHaveBeenCalled()
  expect(where()).toBe(`/home/${C}`)
})

test('구매 요청은 창 기록 없이 페이지로 열고 직접 열어도 뒤에 목록 칸을 새로 끼우지 않는다', () => {
  const push = vi.spyOn(window.history, 'pushState')
  window.history.replaceState(null, '', `/purchases/${C}/${R}`)
  layerDirectRecord()
  expect(push).not.toHaveBeenCalled()
  navigate(`/purchases/${C}/${R}`)
  expect(window.history.state as unknown).not.toHaveProperty(ADOPT_KEY)
})

test('초안은 현재 history 칸에서만 갱신하고 다른 주소로 복사하지 않는다', () => {
  const draft = { sourceMessageId: R, title: '비공개 초안' }
  navigate(`/finance/${C}/requests/new`, { pageState: draft })
  expect(pageState()).toEqual(draft)
  savePageState({ ...draft, title: '고친 초안' })
  expect(pageState()).toEqual({ ...draft, title: '고친 초안' })
  expect(where()).toBe(`/finance/${C}/requests/new`)
  navigate(`/home/${C}`)
  expect(pageState()).toBeUndefined()
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
  window.history.replaceState(null, '', `/tasks/${C}/${R}`)
  layerDirectRecord()
  expect(push).toHaveBeenCalledTimes(1)
  expect(where()).toBe(`/tasks/${C}/${R}`)
  layerDirectRecord()
  expect(push).toHaveBeenCalledTimes(1)
  window.history.back()
})
