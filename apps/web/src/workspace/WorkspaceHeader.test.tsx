// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { eventTrail, trailOf } from './pages'
import WorkspaceHeader from './WorkspaceHeader'

afterEach(cleanup)

const COUNCIL = '컴퓨터학부 학생회'

function show(trail = trailOf('events', COUNCIL, eventTrail('신입생 환영회', '업무'))) {
  render(<WorkspaceHeader crumbs={trail.crumbs} title={trail.title} onMenu={() => {}} />)
  const banner = screen.getByRole('banner')
  const path = within(banner).getByRole('list', { name: '경로' })
  return { banner, path, items: within(path).getAllByRole('listitem') }
}

// 와이어프레임 사이드바 v6.2 머리글(OPS-TASK-01·EVT-02): 높이 h-16, 남은 폭을 다 쓰고 왼쪽에 붙는다.
test('머리글은 높이 h-16이고 가운데로 모으지 않는다', () => {
  const { banner } = show()
  expect(banner.className).toContain('h-16')
  const all = [banner, ...banner.querySelectorAll('*')]
  expect(all.some(node => /\bmx-auto\b|\bmax-w-/.test(node.getAttribute('class') ?? ''))).toBe(
    false,
  )
})

test('경로 줄은 제목 위에 있고 칸을 > 아이콘으로 잇는다', () => {
  const { banner, path, items } = show()
  expect(items.map(item => item.textContent)).toEqual([COUNCIL, '행사', '신입생 환영회', '업무'])
  expect(path.querySelectorAll('svg')).toHaveLength(items.length - 1)
  const title = within(banner).getByRole('heading', { level: 1, name: '신입생 환영회' })
  expect(path.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('마지막 칸만 진하고, 칸은 누를 수 없다', () => {
  const { path, items } = show()
  const dark = items.map(item => item.querySelector('span')!.className.includes('text-gray-700'))
  expect(dark).toEqual([false, false, false, true])
  expect(path.className).toContain('text-gray-500')
  expect(within(path).queryAllByRole('button')).toHaveLength(0)
  expect(within(path).queryAllByRole('link')).toHaveLength(0)
})

test('넘치면 학생회 이름과 행사명이 말줄임되고 올리면 전체 이름이다. 다른 칸은 줄지 않는다', () => {
  const { items } = show()
  const [council, events, event, tab] = items.map(item => item.querySelector('span')!)
  for (const crumb of [council!, event!]) {
    expect(crumb.className).toContain('truncate')
    expect(crumb.getAttribute('title')).toBe(crumb.textContent)
  }
  for (const crumb of [events!, tab!]) {
    expect(crumb.className).not.toContain('truncate')
    expect(crumb.closest('li')!.className).toContain('shrink-0')
  }
})

test('홈은 학생회 이름 한 칸이 마지막 칸이라 진하고 제목은 홈이다', () => {
  const { banner, items } = show(trailOf('home', COUNCIL, null))
  expect(items.map(item => item.textContent)).toEqual([COUNCIL])
  expect(items[0]!.querySelector('span')!.className).toContain('text-gray-700')
  expect(within(banner).getByRole('heading', { level: 1 }).textContent).toBe('홈')
})
