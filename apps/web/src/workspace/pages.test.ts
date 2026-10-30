import { expect, test } from 'vitest'
import type { PageTrail } from '@/components/PageHeading'
import {
  eventTrail,
  pageTitles,
  pageWidthOf,
  peopleTrail,
  settingsTrail,
  trailOf,
  type Page,
} from './pages'

const COUNCIL = '컴퓨터학부 학생회'
const labels = (page: Page, deeper: PageTrail | null = null) =>
  trailOf(page, COUNCIL, deeper).crumbs.map(crumb => crumb.label)

// 넓은 모니터에서도 칸이 길어지지 않게 모든 화면이 1280px 틀이고, 설정만 768px, 대화 화면은 끝까지다(DEC-117 초안, DEC-101 고침).
test.each([
  ['home', 'default'],
  ['chat', 'full'],
  ['council', 'full'],
  ['events', 'default'],
  ['tasks', 'default'],
  ['meetings', 'default'],
  ['calendar', 'default'],
  ['purchases', 'default'],
  ['finance', 'default'],
  ['people', 'default'],
  ['departments', 'default'],
  ['records', 'default'],
  ['settings', 'narrow'],
] as const)('%s의 폭은 %s이다', (page, width) => {
  expect(pageWidthOf(page)).toBe(width)
})

test.each([
  [undefined, 'full'],
  ['messages', 'full'],
  ['overview', 'default'],
  ['tasks', 'default'],
] as const)('행사 기록의 %s 탭 폭은 %s이다', (tab, width) => {
  expect(pageWidthOf('events', { kind: 'events', tab })).toBe(width)
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
  ['meetings', '회의'],
  ['finance', '재정'],
  ['purchases', '구매'],
  ['people', '조직'],
  ['departments', '조직'],
  ['settings', '설정'],
])('%s의 경로는 학생회 이름 > %s이다', (page, crumb) => {
  expect(labels(page)).toEqual([COUNCIL, crumb])
})

test('설정의 경로 끝 칸과 제목은 지금 탭이다', () => {
  expect(labels('settings', settingsTrail('계좌'))).toEqual([COUNCIL, '설정', '계좌'])
  expect(trailOf('settings', COUNCIL, settingsTrail('계좌')).title).toBe('계좌')
})

test('설정의 제목은 학생회 정보이고, 다른 메뉴의 제목은 경로 끝 칸과 같다', () => {
  expect(trailOf('settings', COUNCIL, null).title).toBe('학생회 정보')
  expect(trailOf('chat', COUNCIL, null).title).toBe('메시지')
})

test('사람과 옛 부서 주소는 같은 조직 화면이라 제목이 조직이다', () => {
  expect([pageTitles.people.title, pageTitles.departments.title]).toEqual(['조직', '조직'])
})

test('조직 경로는 보이는 탭이 둘일 때만 탭 이름을 붙인다', () => {
  expect(labels('people', peopleTrail('부서 및 구성원'))).toEqual([
    COUNCIL,
    '조직',
    '부서 및 구성원',
  ])
  expect(labels('people', peopleTrail('납부자 명단'))).toEqual([COUNCIL, '조직', '납부자 명단'])
  expect(labels('people', peopleTrail(null))).toEqual([COUNCIL, '조직'])
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
