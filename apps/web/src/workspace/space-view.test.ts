import { expect, test } from 'vitest'
import { activeItemOf, eventInitial, menuActive } from './space-view'
import { parseAppPath } from '@vada/contracts'
import { targetOf } from './address'
import { myCouncil } from '@/test-support/council-fixtures'

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

const councilId = '0199d1a0-0000-7000-8000-0000000000c1'
const recordId = '0199d1a0-0000-7000-8000-0000000000a1'
test.each([
  ['home', 'home'],
  ['chat', 'chat'],
  [`chat/${recordId}`, 'chat'],
  ['tasks', 'tasks'],
  [`tasks/${recordId}`, 'tasks'],
  ['events', 'events'],
  [`events/${recordId}`, 'events'],
  [`events/${recordId}?tab=messages`, 'events'],
  [`events/${recordId}?tab=money`, 'events'],
  ['calendar', 'menu'],
  ['purchases', 'menu'],
  [`purchases/${recordId}`, 'menu'],
  ['finance', 'menu'],
  [`expenses/${recordId}`, 'menu'],
  [`incomes/${recordId}`, 'menu'],
  ['people', 'menu'],
  ['settings', 'menu'],
])('휴대폰 %s는 %s 하나만 켠다', (address, expected) => {
  const [menu, ...rest] = address.split('/')
  const path = `/${menu}/${councilId}${rest.length ? `/${rest.join('/')}` : ''}`
  const target = targetOf(
    { path, location: parseAppPath(path), key: '', released: false, from: null },
    [myCouncil(councilId)],
  )
  expect(target.kind).toBe('ready')
  if (target.kind !== 'ready') return
  const active = activeItemOf(target.page, target.record?.kind === 'events' ? recordId : null, [])
  const items = ['home', 'chat', 'tasks', 'events', 'menu'] as const
  expect(items.filter(item => menuActive(active, item, 'mobile'))).toEqual([expected])
})

test('켤 칸은 메뉴, 묶음의 행사 줄, [전체 행사 보기] 가운데 하나이고 설정은 없다', () => {
  expect(activeItemOf('home', null, shown)).toEqual({ kind: 'menu', menu: 'home' })
  expect(activeItemOf('tasks', null, shown)).toEqual({ kind: 'menu', menu: 'tasks' })
  expect(activeItemOf('events', 'e2', shown)).toEqual({ kind: 'event', id: 'e2' })
  expect(activeItemOf('events', 'e9', shown)).toEqual({ kind: 'allEvents' })
  expect(activeItemOf('events', null, shown)).toEqual({ kind: 'allEvents' })
  expect(activeItemOf('events', 'e1', [])).toEqual({ kind: 'allEvents' })
  expect(activeItemOf('settings', null, shown)).toBeNull()
})
