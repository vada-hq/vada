// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { rememberTaskLayout, withTaskLayout } from './task-layout'

test('캘린더 메뉴 분리 뒤 업무 링크에는 기억한 달력을 싣지 않고 행사에는 남긴다', () => {
  rememberTaskLayout('m1', 'calendar')
  expect(withTaskLayout('m1', {}, false)).toEqual({})
  expect(withTaskLayout('m1', { tab: 'tasks' })).toEqual({ tab: 'tasks', layout: 'calendar' })
})

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

test('기억이 없으면 쿼리를 그대로 둔다(보드)', () => {
  expect(withTaskLayout('m1', {})).toEqual({})
  expect(withTaskLayout('m1', { tab: 'tasks' })).toEqual({ tab: 'tasks' })
})

test('마지막에 고른 배치를 쿼리에 싣고, 사람마다 따로다', () => {
  rememberTaskLayout('m1', 'list')
  expect(withTaskLayout('m1', {})).toEqual({ layout: 'list' })
  expect(withTaskLayout('m2', {})).toEqual({})
  rememberTaskLayout('m1', 'board')
  expect(withTaskLayout('m1', { tab: 'tasks' })).toEqual({ tab: 'tasks', layout: 'board' })
})

test('주소에 이미 배치가 있으면 주소가 이긴다', () => {
  rememberTaskLayout('m1', 'calendar')
  expect(withTaskLayout('m1', { layout: 'list' })).toEqual({ layout: 'list' })
})

test('사람을 모르거나 저장소의 값이 망가졌으면 싣지 않는다', () => {
  rememberTaskLayout('m1', 'list')
  expect(withTaskLayout(null, {})).toEqual({})
  window.localStorage.setItem('vada.task.layout.m1', 'nope')
  expect(withTaskLayout('m1', {})).toEqual({})
})

test('저장소를 못 쓰는 브라우저에서도 던지지 않고 보드다', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(() => rememberTaskLayout('m1', 'list')).not.toThrow()
  expect(withTaskLayout('m1', {})).toEqual({})
})
