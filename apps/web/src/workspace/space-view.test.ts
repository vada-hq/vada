import { expect, test } from 'vitest'
import { activeItemOf, eventInitial } from './space-view'

test('행사 줄의 첫 글자는 앞의 연도 글을 지운 뒤의 첫 글자이고, 지우면 비면 원래 이름의 첫 글자다', () => {
  expect(eventInitial('2026 체육대회')).toBe('체')
  expect(eventInitial('2026학년도 새내기 배움터')).toBe('새')
  expect(eventInitial('2026학년도새내기')).toBe('새')
  expect(eventInitial('축제 2026')).toBe('축')
  expect(eventInitial('2026')).toBe('2')
  expect(eventInitial('2026학년도')).toBe('2')
  expect(eventInitial('12 축제')).toBe('1')
  // 이모지는 반쪽으로 자르지 않는다.
  expect(eventInitial('🎉 축제')).toBe('🎉')
})

const shown = [{ id: 'e1' }, { id: 'e2' }]

test('켤 칸은 메뉴, 묶음의 행사 줄, [행사 모두 보기] 가운데 하나이고 설정은 없다', () => {
  expect(activeItemOf('home', null, shown)).toEqual({ kind: 'menu', menu: 'home' })
  expect(activeItemOf('tasks', null, shown)).toEqual({ kind: 'menu', menu: 'tasks' })
  expect(activeItemOf('events', 'e2', shown)).toEqual({ kind: 'event', id: 'e2' })
  expect(activeItemOf('events', 'e9', shown)).toEqual({ kind: 'allEvents' })
  expect(activeItemOf('events', null, shown)).toEqual({ kind: 'allEvents' })
  expect(activeItemOf('events', 'e1', [])).toEqual({ kind: 'allEvents' })
  expect(activeItemOf('settings', null, shown)).toBeNull()
})
