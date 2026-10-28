import { expect, test } from 'vitest'
import type { PageTrail } from '@/components/PageHeading'
import { eventTrail, pageTitles, pageWidthOf, trailOf, type Page } from './pages'

const COUNCIL = '컴퓨터학부 학생회'
const labels = (page: Page, deeper: PageTrail | null = null) =>
  trailOf(page, COUNCIL, deeper).crumbs.map(crumb => crumb.label)

test.each([
  ['home', 'default'],
  ['chat', 'full'],
  ['council', 'full'],
  ['events', 'default'],
  ['tasks', 'full'],
  ['calendar', 'full'],
  ['purchases', 'default'],
  ['finance', 'default'],
  ['people', 'default'],
  ['departments', 'default'],
  ['settings', 'narrow'],
] as const)('%s의 폭은 %s이다(DEC-101)', (page, width) => {
  expect(pageWidthOf(page)).toBe(width)
})

test('행사 목록은 기본 폭이고 행사 기록은 탭과 관계없이 끝까지다', () => {
  expect(pageWidthOf('events')).toBe('default')
  expect(pageWidthOf('events', 'events')).toBe('full')
  expect(pageWidthOf('home', 'events')).toBe('default')
})

// 경로 줄 맨 앞은 학생회 이름이고, 칸은 DEC-96 그대로다.
test('홈은 학생회 이름 한 칸과 제목 홈이다', () => {
  expect(labels('home')).toEqual([COUNCIL])
  expect(trailOf('home', COUNCIL, null).title).toBe('홈')
})

test.each<[Page, string]>([
  ['chat', '메시지'],
  ['events', '행사'],
  ['tasks', '업무'],
  ['finance', '재정'],
  ['purchases', '구매'],
  ['people', '조직'],
  ['departments', '조직'],
  ['settings', '설정'],
])('%s의 경로는 학생회 이름 > %s이다', (page, crumb) => {
  expect(labels(page)).toEqual([COUNCIL, crumb])
})

test('설정의 제목은 학생회 정보이고, 다른 메뉴의 제목은 경로 끝 칸과 같다', () => {
  expect(trailOf('settings', COUNCIL, null).title).toBe('학생회 정보')
  expect(trailOf('chat', COUNCIL, null).title).toBe('메시지')
})

test('사람과 옛 부서 주소는 같은 조직 화면이라 제목이 조직이다', () => {
  expect([pageTitles.people.title, pageTitles.departments.title]).toEqual(['조직', '조직'])
})

test('행사 업무 탭은 학생회 > 행사 > 행사명 > 업무이고 제목은 행사명이다', () => {
  const trail = trailOf('events', COUNCIL, eventTrail('신입생 환영회', '업무'))
  expect(trail.crumbs.map(crumb => crumb.label)).toEqual([COUNCIL, '행사', '신입생 환영회', '업무'])
  expect(trail.title).toBe('신입생 환영회')
})

test('넘치면 줄이는 칸은 학생회 이름과 행사명뿐이다', () => {
  const trail = trailOf('events', COUNCIL, eventTrail('신입생 환영회', '업무'))
  expect(trail.crumbs.map(crumb => crumb.truncate)).toEqual([true, false, true, false])
})
